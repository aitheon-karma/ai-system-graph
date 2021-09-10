import { ModalService } from '@aitheon/core-client';
import { Connection, Node } from '@aitheon/lib-graph';
import {
  Mapping,
  MappingNode,
  PredefinedElement,
  Socket,
  SocketMetadata,
  SocketsRestService
} from '@aitheon/system-graph';
import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ObjectID } from 'bson';
import * as d3 from 'd3';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';

import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, forkJoin, Observable, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

import { IoType } from '../../../shared/enums/io-type.enum';
import { MappingDataType } from '../../../shared/enums/mapping-data-type.enum';
import { MappingModalData } from '../../../shared/interfaces/mapping-modal-data.interface';
import { MappingProperty } from '../../../shared/interfaces/mapping-property.interface';
import { NodeData } from '../../../shared/models/node.model';
import { SharedService } from '../../../shared/services/shared.service';
import { isValidType } from '../../../shared/utils/is-valid-type';
import { NodeWithIo } from '../../shared/interfaces/node-with-io.interface';
import { GraphEditorService } from '../../shared/services/graph-editor.service';
import { MappingConnection, MappingService } from '../../shared/services/mapping-service';
import { NodesService } from '../../shared/services/nodes.service';
import { SocketsService } from '../../shared/services/sockets.service';

interface SchemaData {
  properties: {
    [key: string]: SchemaData;
  };
  default?: string;
  pattern?: string;
  type?: string;
  title?: string;
  description?: string;
  enum?: string[];
  required?: string[];
}

@Component({
  selector: 'ai-mapping-modal',
  templateUrl: './mapping-modal.component.html',
  styleUrls: ['./mapping-modal.component.scss']
})
export class MappingModalComponent implements OnInit, OnDestroy {
  @ViewChild('modalView') modalView: TemplateRef<any>;

  subscriptions$ = new Subscription();
  selectedConnections$: Observable<MappingConnection[]>;
  modalRef: BsModalRef;
  type = 'MAPPING_MODAL';
  data: MappingModalData;
  ioType = IoType;
  customProperties: MappingProperty[] = [];
  inputProperties: MappingProperty[] = [];
  outputProperties: MappingProperty[] = [];
  isInputsLoading: boolean;
  isOutputsLoading: boolean;
  selectedInput: SocketMetadata;
  selectedOutput: SocketMetadata;
  outputNode: NodeWithIo;
  inputNodes: NodeWithIo[];
  outputConnections: Connection[] = [];
  inputChanged: boolean;
  hasConnections: boolean;
  isLoading: boolean;
  isCompatibleMessageClosed: boolean;
  private anyDataSocketId: string;

  constructor(
    private bsModalService: BsModalService,
    private modalService: ModalService,
    private toastr: ToastrService,
    private sharedService: SharedService,
    private socketsService: SocketsService,
    private socketsRestService: SocketsRestService,
    private graphEditorService: GraphEditorService,
    private nodesService: NodesService,
    private mappingService: MappingService,
  ) {}

  ngOnInit(): void {
    this.anyDataSocketId = this.socketsService.anySocketId;
    this.selectedConnections$ = this.mappingService.selectedConnections$;
    this.subscriptions$.add(this.modalService.openModal$.subscribe(({ type, data }) => {
      if (type === this.type) {
        this.isLoading = true;
        this.clearData();
        this.data = data;
        this.show();
      }
    }));
    this.listenToConnectionsChange();
  }

  private show(): void {
    this.modalRef = this.bsModalService.show(this.modalView, {
      ignoreBackdropClick: true,
      class: 'mapping-modal',
    });

    const svg = d3.select('.mapping-modal__content').append('svg');
    this.mappingService.setSvgSelection(svg);

    this.mappingService.customProperties = [];
    if (this.data.isExist) {
      this.loadExistingMapping();
      this.setAvailableIoForExistingNode();
    } else {
      this.setAvailableIoForNewNode();
    }
  }

  listenToConnectionsChange(): void {
    this.subscriptions$.add(this.mappingService.connections$.subscribe(c => {
      const t = setTimeout(() => {
        this.hasConnections = !!c.length;
        this.isLoading = false;
        clearTimeout(t);
      });
    }));
  }

  private setAvailableIoForNewNode(): void {
    this.outputNode = {
      nodeId: this.data.outputNodeId,
      nodeName: this.data.outputNodeData.name,
      io: this.data.outputNodeData.outputs,
      filteredIo: [],
    };
    this.inputNodes = [{
      nodeId: this.data.inputNodeId,
      nodeName: this.data.inputNodeData.name,
      io: this.data.inputNodeData.inputs,
      filteredIo: [],
    }];

    if (this.data.isIoSelected) {
      this.selectIo();
    }

    this.isLoading = false;
  }

  selectIo(): void {
    const input = this.inputNodes[0]?.io?.find(io => io._id === this.data.inputId);
    if (input) {
      this.onIoSelect({ ioType: IoType.INPUT, io: input });
    }
    const output = this.outputNode?.io?.find(io => io._id === this.data.outputId);
    if (output) {
      this.onIoSelect({ ioType: IoType.OUTPUT, io: output });
    }
  }

  public closeCompatibleMessage(): void {
    this.isCompatibleMessageClosed = true;
  }

  private setAvailableIoForExistingNode(): void {
    const [outputNode] = this.getNodesWithIo(this.data.node, 'inputs');
    this.outputNode = outputNode;
    this.inputNodes = this.getNodesWithIo(this.data.node, 'outputs');
  }

  private loadExistingMapping(): void {
    this.addCustomFields(this.mappingNodeData.customFields);
    this.mappingService.setDbConnections([...this.mappingNodeData.mapping, ...this.mappingNodeData.customFields]);
    this.selectedOutput = this.mappingNodeData.input;
    this.selectedInput = this.mappingNodeData.output;
    this.mappingService.setIo(IoType.OUTPUT, this.selectedOutput);
    this.mappingService.setIo(IoType.INPUT, this.selectedInput);
    forkJoin([
      this.getSocket(this.selectedOutput.socket as any),
      this.getSocket(this.selectedInput.socket as any),
    ]).pipe(take(1)).subscribe(([outputSocket, inputSocket]) => {
        this.processSocketSchema(outputSocket, IoType.OUTPUT, true);
        this.processSocketSchema(inputSocket, IoType.INPUT, true);
      },
      e => {
        this.toastr.error(e?.message || 'Unable to get socket data');
      });
  }

  private addCustomFields(fields: PredefinedElement[]): void {
    const values = this.getValuesFromFields(fields);
    for (const value of values) {
      const type = this.getValueType(value);
      if (type) {
        this.addCustomField(type, value);
      }
    }
  }

  private getValuesFromFields(fields: PredefinedElement[]): string[] {
    const nonUniqueValues = fields.map(f => f.value);
    return Array.from(new Set(nonUniqueValues));
  }

  getValueType(val: any): MappingDataType {
    for (const type of Object.keys(MappingDataType)) {
      if (isValidType(type as any, val)) {
        return type as any;
      }
    }
  }

  public connectAll(): void {
    this.mappingService.connectAll();
  }

  private getSocket(socketId: string): Observable<Socket> {
    return this.socketsRestService.getById(socketId);
  }

  public onIoSelect(data: { ioType: IoType, io: SocketMetadata }): void {
    this.isLoading = true;
    if (data.ioType === IoType.INPUT) {
      this.selectedInput = data.io;
      this.isInputsLoading = true;
    } else {
      this.selectedOutput = data.io;
      this.isOutputsLoading = true;
    }
    this.isCompatibleMessageClosed = false;
    this.mappingService.clearConnections();
    this.getSocket(data.io.socket as any)
      .pipe(take(1))
      .subscribe(
        socket => { this.processSocketSchema(socket, data.ioType); },
        e => { this.toastr.error(e?.message || 'Unable to get socket data'); },
        () => { this.isLoading = false; }
      );
  }

  private processSocketSchema(socket: Socket, ioType: IoType, isNodeExist?: boolean): void {
    if (socket.structure?.properties) {
      const compiledSocketProperties = Object.keys(socket.structure.properties)
        .map(prop => this.compileSchemaRecursively(
          socket.structure.properties[prop],
          prop, // property name
          socket.structure.required,
          0,
          prop, // property path
          ioType,
          isNodeExist,
          socket._id,
        )).sort((p, n) => p.nestedProperties ? 1 : -1);
      if (ioType === IoType.INPUT) {
        this.inputProperties = compiledSocketProperties;
        this.mappingService.inputProperties = this.inputProperties;
      } else {
        this.outputProperties = compiledSocketProperties;
        this.mappingService.outputProperties = this.outputProperties;
      }
      this.isInputsLoading = this.isOutputsLoading = false;
    }
  }

  compileSchemaRecursively(
    data: SchemaData,
    propertyName: string,
    required: string[] = [],
    nestingLevel: number = 0,
    path: string = '',
    ioType: IoType,
    isNodeExist: boolean,
    socketId?: string,
  ): MappingProperty {
    const property = {
      propertyName: propertyName,
      path,
      type: data.type,
      enum: data.enum,
      description: data.description,
      default: data.default,
      required: required.includes(propertyName),
      nestingLevel,
      loaded$: new BehaviorSubject<boolean>(false),
      nestedProperties: data?.properties
        ? Object.keys(data.properties)
          .map(prop => this.compileSchemaRecursively(
            data.properties[prop],
            prop,
            data.required,
            nestingLevel + 1,
            `${path}.${prop}`,
            ioType,
            isNodeExist,
          )).sort((p, n) => p.nestedProperties ? 1 : -1)
        : null,
    } as unknown as MappingProperty;
    if (socketId === this.anyDataSocketId) {
      property.isAnyData = true;
    }
    if (isNodeExist) {
      this.addValueToProperty(property, ioType);
    }
    return property;
  }

  addValueToProperty(property: MappingProperty, ioType: IoType): void {
    if (ioType === IoType.INPUT && this.data.isExist) {
      const staticField = this.mappingNodeData.staticFields.find(({ to }) => to === property.path);
      if (staticField?.hasOwnProperty('value')) {
        property.value = staticField.value;
        property.valueType = 'static';
      }
      const defaultField = this.mappingNodeData.mapping.find(({ to }) => to === property.path);
      if (defaultField?.hasOwnProperty('defaultValue')) {
        property.value = defaultField.defaultValue;
        property.valueType = 'default';
      }
    }
  }

  public addCustomField(type: MappingDataType, value?: any): void {
    const property = {
      type,
      path: this.sharedService.uuidv4Generator(),
      propertyName: '',
      nestingLevel: 0,
      required: true,
      isCustom: true,
      value,
      loaded$: new BehaviorSubject<boolean>(false),
    };
    this.customProperties.push(property);
    this.mappingService.addCustomProperty(property);
  }

  public removeProperty(index: number): void {
    this.customProperties.splice(index, 1);
  }

  public hide(event?: Event): void {
    if (event) {
      this.stopEvent(event);
    }
    this.modalRef.hide();
    this.nodesService.dropMappingConnections();
  }

  private clearData(): void {
    this.selectedInput = null;
    this.selectedOutput = null;
    this.data = null;
    this.customProperties = [];
    this.inputProperties = [];
    this.outputProperties = [];
    this.outputConnections = [];
    this.inputChanged = false;
  }

  public onSectionScroll(scrollingPart: 'input' | 'output'): void {
    this.mappingService.updateConnectionsUI(scrollingPart);
  }

  public onContentScroll(event: Event, leftPropertiesContainer: HTMLElement, rightPropertiesContainer: HTMLElement): void {
    const { path, deltaY } = event as any;
    if (path?.find(el => el.classList && el.classList.contains('mapping-modal__io-properties-wrap'))) {
      return;
    }
    leftPropertiesContainer.scroll({ behavior: 'auto', top: leftPropertiesContainer.scrollTop + deltaY });
    rightPropertiesContainer.scroll({ behavior: 'auto', top: rightPropertiesContainer.scrollTop + deltaY });

    this.mappingService.updateConnectionsUI();
  }

  private stopEvent(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
  }

  public getButtonCoordinates(connection: MappingConnection): { left: string, top: string } {
    return {
      left: `${connection.output.coordinates.x + ((connection.input.coordinates.x - connection.output.coordinates.x) / 2)}px`,
      top: `${connection.output.coordinates.y + ((connection.input.coordinates.y - connection.output.coordinates.y) / 2) + 64}px`,
    };
  }

  public removeConnection(event: Event, connection: MappingConnection): void {
    const outputConnections = this.mappingService.getConnectionsByIo(IoType.OUTPUT, connection.output.path);
    this.mappingService.removeConnection(connection);
    if (outputConnections?.length > 1) {
      this.stopEvent(event);
      this.mappingService.transparentizeNotActiveConnections(IoType.OUTPUT, connection.output.path);
    }
  }

  public save(): void {
    this.mappingService.setSubmitted(true);
    this.mappingService.createMapping().subscribe(mapping => {
      if (this.selectedInput && this.selectedOutput) {
        if (!this.data.isExist) {
          this.createNewMappingNode(mapping);
        } else {
          this.updateMappingNode(mapping);
        }
      }
    }, e => {
      this.toastr.error(e?.message);
    });
  }

  createNewMappingNode(mapping: any): void {
    const mappingNodePosition = this.graphEditorService.getAveragedPositionOfNodes(
      this.data.outputNodeId,
      this.data.inputNodeId,
    );
    const mappingNode = {
      ...mapping,
      position: mappingNodePosition,
      input: { ...this.selectedOutput, _id: new ObjectID().toString(), placement: null },
      output: { ...this.selectedInput, _id: new ObjectID().toString(), placement: null },
    } as MappingNode;
    mappingNode._id = new ObjectID().toString();
    const graphNode = this.graphEditorService.createNode('mapping', mappingNode, mappingNodePosition);
    this.graphEditorService.addNode(graphNode);
    this.graphEditorService.connect(
      { node: this.data.outputNodeId, output: this.selectedOutput },
      { node: mappingNode._id, input: (mappingNode as any).input },
    );
    this.graphEditorService.connect(
      { node: mappingNode._id, output: (mappingNode as any).output },
      { node: this.data.inputNodeId, input: this.selectedInput },
    );
    this.nodesService.dropMappingConnections();
    this.hide();
  }

  updateMappingNode(data: any): void {
    this.mappingNodeData.staticFields = data.staticFields;
    this.mappingNodeData.customFields = data.customFields;
    this.mappingNodeData.mapping = data.mapping;
    if (this.inputChanged) {
      this.reconnectNodeIo(IoType.OUTPUT);
    }
    if (this.selectedOutput._id !== this.mappingNodeData.input._id) {
      this.reconnectNodeIo(IoType.INPUT);
    }

    this.graphEditorService.save();
    this.hide();
  }

  reconnectNodeIo(ioType: IoType): void {
    this.graphEditorService.clearNodeConnections(this.data.node, ioType);
    this.graphEditorService.removeNodeIo(this.data.node, ioType);
    let ioData: SocketMetadata;
    if (ioType === IoType.INPUT) {
      ioData = { ...this.selectedOutput, _id: this.mappingNodeData.input._id, placement: null };
      this.data.node.data.input = ioData;
    } else {
      ioData = { ...this.selectedInput, _id: this.mappingNodeData.output._id, placement: null };
      this.data.node.data.output = ioData;
    }
    this.graphEditorService.addIoToNode(this.data.node, ioData, ioType);
    if (ioType === IoType.INPUT) {
      this.graphEditorService.connect(
        { node: this.getNodeByIoId(this.selectedOutput._id, IoType.OUTPUT), output: this.selectedOutput },
        { node: this.data.node.id as any, input: ioData },
      );
    } else {
      this.graphEditorService.connect(
        { node: this.data.node.id as any, output: ioData },
        { node: this.getNodeByIoId(this.selectedInput._id, IoType.INPUT), input: this.selectedInput },
      );
    }
  }

  private getNodeByIoId(socketMetadataId: string, ioType: IoType): string {
    const nodes = ioType === IoType.INPUT ? this.inputNodes : [this.outputNode];
    for (const node of nodes) {
      if (node.io.find(({ _id }) => _id === socketMetadataId)) {
        return node.nodeId;
      }
    }
    return null;
  }

  getNodesWithIo(node: Node, ioType: 'inputs' | 'outputs'): NodeWithIo[] {
    const nodesWithIo: NodeWithIo[] = [];
    const connectedNodesIds: string[] = [];
    const oppositeKey = ioType === 'inputs' ? 'output' : 'input';
    node[ioType].forEach(io => {
      for (const connection of io.connections) {
        if (ioType === 'outputs') {
          this.outputConnections.push(connection);
        }
        const connectedNode = connection[oppositeKey].node;
        const connectedNodeId = connectedNode.id as unknown as string;
        const connectedNodeData = connectedNode.data as unknown as NodeData;
        if (!connectedNodesIds.includes(connectedNodeId)) {
          connectedNodesIds.push(connectedNodeId);
          nodesWithIo.push({
            nodeId: connectedNodeId,
            nodeName: connectedNode.data.name as any,
            io: connectedNodeData[`${oppositeKey}s`],
            filteredIo: [],
          });
        }
      }
    });
    return nodesWithIo;
  }

  clearConnections(): void {
    this.mappingService.clearConnections();
  }

  get mappingNodeData(): {
    _id: string;
    input: SocketMetadata,
    output: SocketMetadata,
    customFields: PredefinedElement[],
    staticFields: PredefinedElement[],
    mapping: Mapping[],
    position: [number, number],
  } {
    return (this.data.node as any).data;
  }

  ngOnDestroy(): void {
    if (this.subscriptions$) {
      this.subscriptions$.unsubscribe();
    }
  }
}
