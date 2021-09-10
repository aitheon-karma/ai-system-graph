import {
  ApplicationBuildService,
  ApplicationType,
  AuthService, ConfirmData,
  GraphRefType,
  GraphType,
  ModalService,
  NodeStatus,
  NodeType,
} from '@aitheon/core-client';
import { Input, InteractionType, IO, IoConfig, Output } from '@aitheon/lib-graph';

import { NodeComponent as GraphNode, NodeService } from '@aitheon/lib-graph-render-plugin';
import { FunctionalNode, Graph } from '@aitheon/system-graph';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  NgZone,
  OnDestroy,
  Renderer2,
} from '@angular/core';

import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { ObjectID } from 'bson';
import { Observable, of, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, take } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { GraphsService } from '../../../graphs/graphs.service';
import { IoType } from '../../../shared/enums/io-type.enum';
import { SocketPlacement } from '../../../shared/enums/socket-placement.enum';
import { ConnectionData } from '../../../shared/interfaces/connection-data.interface';
import { ConnectionPickData } from '../../../shared/interfaces/connection-pick-data.interface';
import { NodeReference } from '../../../shared/interfaces/node-reference.interface';
import { StoreRequestForm } from '../../../shared/interfaces/store-requst-form.interface';
import { MappingIo } from '../../../shared/models/mapping-io.model';
import { NodeIo } from '../../../shared/models/node-io.model';
import { NodeData } from '../../../shared/models/node.model';
import { SharedService } from '../../../shared/services/shared.service';
import { get } from '../../../shared/utils/get';
import { titleCase } from '../../../shared/utils/titlecase';
import { GraphEditorService } from '../../shared/services/graph-editor.service';

import { NodesService } from '../../shared/services/nodes.service';
import { SocketData, SocketsService } from '../../shared/services/sockets.service';
import { getIoMetadataFromKey } from '../../shared/utils/get-io-metadata-from-key';

interface IoContext {
  callback: (event: Event) => void;
  className: string;
  title: string;
  placeholder: string;
}

@Component({
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
  providers: [NodeService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeComponent extends GraphNode implements AfterViewInit, OnDestroy {
  /** IO */
  public nodeIo: NodeIo[] = [];
  public mappingIo: MappingIo[] = [];
  /** IO END */

  public graph: Graph;
  referenceName$: Observable<NodeReference>;
  user$: Observable<{ envAccess: string }>;
  subscriptions$ = new Subscription();
  connectionPickData: ConnectionPickData;
  loading = true;
  nodeContainer: HTMLElement;
  isNameDuplicated = false;
  nodeNameControl: FormControl;
  anchorElement = null;
  editingModel = false;
  model: {
    _id: string,
    name: string,
    summary: string,
  };
  addIoContext: IoContext;
  ioControl: FormControl;
  ioControlFocused: boolean;
  nodeType = {
    ...NodeType,
    SUBGRAPH: 'SUBGRAPH',
    SERVICE: 'SERVICE',
    CREATED: 'CREATED',
    DEVICE_NODE: 'DEVICE_NODE',
    COMPUTE_NODE: 'COMPUTE_NODE',
    ROBOT: 'ROBOT',
    APP: 'APP'
  };
  nodeSubType = {
    ...GraphRefType,
  };
  nodeHeight: string;
  editingIo: IO;
  clickEvent: MouseEvent;
  socketPlacements = SocketPlacement;
  ioDragging: boolean;
  currentUser: any;

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    this.clickEvent = event;
    event.stopPropagation();
    const checkClassList = className => (<HTMLElement>event.target).classList.contains(className);
    if (!checkClassList('node__show-more')) {
      this.anchorElement = null;
      this.node.update();
    }
    if (!checkClassList('node__name-input') && this.nodeNameControl) {
      this.updateNodeName(this.nodeNameControl.value);
    }

    if (!checkClassList('node__add-io-input') && this.ioControl && !this.ioControlFocused) {
      this.triggerSaveIo();
    }
  }

  constructor(
    protected service: NodeService,
    protected cd: ChangeDetectorRef,
    protected renderer: Renderer2,
    private nodesService: NodesService,
    private graphsService: GraphsService,
    private graphEditorService: GraphEditorService,
    private socketsService: SocketsService,
    private applicationBuildService: ApplicationBuildService,
    private sharedService: SharedService,
    private modalService: ModalService,
    private authService: AuthService,
    private ngZone: NgZone,
  ) {
    super(service, cd, renderer);
    this.subscriptions$.add(this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    }));
  }

  ngAfterViewInit(): void {
    this.graph = this.graphsService.getGraph();
    if (this.isInformationNode) {
      return;
    }

    this.subscriptions$.add(this.graphsService.graphChanged$.subscribe(() => {
      this.node.update();
    }));

    this.getIoArray();

    if (!this.isSubGraphIo) {
      this.createMappingIo();
      this.setNodeProperties();
    } else {
      this.setSubGraphIoProperties();
    }

    this.onConnectionPick();
    this.onUpdateNodeIo();
    this.onMappingConnectionsDrop();
  }

  onConnectionPick(): void {
    this.subscriptions$.add(this.nodesService.connectionPick$.subscribe(data => {
      this.connectionPickData = data;
      if (this.connectionPickData.nodeId !== this.node.id as any) {
        if (this.connectionPickData.picked && this.connectionPickData.isMappingIo) {
          this.showAvailableMappingIo();
        } else {
          this.hideAvailableMappingIo();
        }
      }
      this.node.update();
    }));
  }

  onUpdateNodeIo(): void {
    this.subscriptions$.add(this.graphEditorService.makeIoVisible$.subscribe(({ node, io }) => {
      // functionality to add IO to node view.
      // if (node === this.node.id as any) {
      //   this.filterNodeIoByConnections();
      //   const [ioName, ioId] = io.key.split('::');
      //   const ioType = io instanceof Input ? IoType.INPUT : IoType.OUTPUT;
      //   const ioData = {
      //     io,
      //     placement: io.placement
      //       ? io.placement
      //       : (io instanceof Input ? SocketPlacement.LEFT : SocketPlacement.RIGHT),
      //     type: ioType,
      //     id: ioId,
      //   } as any;
      //   this.nodeIo.push(ioData);
      //   this.node.update();
      // }
    }));
  }

  setUser(): void {
    this.user$ = this.authService.currentUser;
  }

  filterNodeIoByConnections(): void {
    this.nodeIo.forEach((item, i) => {
      const io = Array.isArray(item.io) ? item.io : [item.io];
      let hasConnection = false;
      for (const ioItem of io) {
        if (ioItem.connections?.length) {
          hasConnection = true;
        }
      }
      if (!hasConnection) {
        this.nodeIo.splice(i, 1);
      }
    });
  }

  onMappingConnectionsDrop(): void {
    this.subscriptions$.add(this.nodesService.mappingConnectionsDrop$.subscribe(() => {
      if (this.mappingIo?.length) {
        for (const mappingIo of this.mappingIo) {
          mappingIo.activeRight = false;
          mappingIo.activeLeft = false;
          const [left, right] = mappingIo.io;
          if (left.hasConnection()) {
            left.connections.forEach(connection => this.editor.removeConnection(connection));
            this.node.update();
          }
          if (right.hasConnection()) {
            right.connections.forEach(connection => this.editor.removeConnection(connection));
            this.node.update();
          }
        }
      }
    }));
  }

  /** STANDARD NODE SECTION */
  setNodeProperties() {
    this.listenToNameUniqueness();
    this.listenToModalClose();
    this.checkNodeForReference();

    if (this.inference.enabled) {
      this.subscriptions$.add(this.nodesService.modelAdded
        .subscribe(({ nodeId, model }) => {
          if (nodeId === this.node.id as any) {
            this.editingModel = true;
            this.model = model;
            this.inference.modelId = model._id;
            this.node.update();
            this.save();
          }
        }));

      this.subscriptions$.add(this.graphEditorService.onHideToolbox
        .subscribe(() => {
          if (this.editingModel) {
            this.editingModel = false;
          }
        }));

      if (this.inference.modelId) {
        this.subscriptions$.add(this.nodesService.getModels()
          .subscribe((models: any[]) => {
            const currentModel = models.find(({ _id }) => _id === this.inference.modelId);
            if (currentModel) {
              this.model = currentModel;
            }
            this.loading = false;
            this.node.update();
          }));
      } else {
        this.loading = false;
        this.node.update();
      }
    }

    if (this.isServiceNode) {
      this.nodeData.status = NodeStatus.RUNNING;
    }
    this.node.update();
  }

  getIoArray() {
    const ioArray = this.concatAndSortIoByPriority();
    // functionality to hide disconnected IO
    // if (this.isAddIoSectionVisible) {
    //   ioArray = ioArray.filter(io => this.graphsService.isIoHasConnection(io));
    // }

    this.nodeIo = ioArray.reduce((result, io) => {
      const { id, placement } = getIoMetadataFromKey(io.key);
      const ioType = io instanceof Input ? IoType.INPUT : IoType.OUTPUT;
      if (!this.isSubGraphIo) {
        if (
          ioType === IoType.INPUT && this.graph?.subType === Graph.SubTypeEnum.SPECIAL && this.isServiceNode
          || placement === SocketPlacement.RIGHT) {
          return result;
        }
        if (placement === SocketPlacement.LEFT) {
          const rightSideIo = ioArray
            .find(({ key }) => (key.includes(id) && key.includes(SocketPlacement.RIGHT)));

          return [
            ...result,
            {
              io: [io, rightSideIo],
              placement: SocketPlacement.CENTER,
              type: ioType,
              id,
            },
          ];
        }
      }
      return [
        ...result,
        {
          io,
          placement: !this.isSubGraphIo && io.placement
            ? io.placement
            : (io instanceof Input ? SocketPlacement.LEFT : SocketPlacement.RIGHT),
          type: ioType,
          id,
        },
      ];
    }, []) as NodeIo[];
  }

  private concatAndSortIoByPriority(): IO[] {
    const io = [...this.inputs, ...this.outputs];
    const ioSettings = this.nodeData?.graphNode?.ioSettings;

    if (ioSettings) {
      const getIoSettingsById = id => ioSettings.find(i => i.io === id);
      return io.sort((previous, next) => {
        const previousIoId = getIoMetadataFromKey(previous.key).id;
        const previousIoOrder = getIoSettingsById(previousIoId)?.order;
        const nextIoId = getIoMetadataFromKey(next.key).id;
        const nextIoOrder = getIoSettingsById(nextIoId)?.order;
        return previousIoOrder - nextIoOrder;
      });
    }
    return io;
  }

  listenToNameUniqueness() {
    this.graphsService.duplicatedNodes.subscribe(nodes => {
      const isDuplicate = nodes.some(node => node.name === this.nodeData.name);
      if (isDuplicate) {
        this.isNameDuplicated = true;
        this.node.update();
        return;
      }
      this.isNameDuplicated = false;
      this.node.update();
    });
  }

  private listenToModalClose(): void {
    this.subscriptions$.add(this.modalService.onModalClose$.subscribe(({ data, type }) => {
      if (data.nodeId === this.node.id) {
        switch (type) {
          case 'NODE_SETTINGS':
            this.saveNodeSettings(data.node);
            break;
        }
      }
    }));
  }

  private checkNodeForReference(): void {
    const reference = this.nodeData.reference || this.nodeData.device?._id;
    if (reference && this.graph?.subType !== Graph.SubTypeEnum.CONTROLLER) {
      this.referenceName$ = this.nodesService.getNodeReference(reference);
    }
  }

  initNodeNameControl(event: Event) {
    this.stopEvent(event);
    if (!this.isSubGraphIo && !this.isDeviceNode &&
      this.nodeData.type !== this.nodeType.SERVICE_NODE &&
      this.nodeData.type !== this.nodeType.SERVICE &&
      !this.isReference) {
      this.nodeNameControl = new FormControl(this.nodeData.name, {
        updateOn: 'blur',
        validators: Validators.required,
      });
      this.nodeNameControl.valueChanges.pipe(
        take(1),
        debounceTime(400),
        distinctUntilChanged(),
      ).subscribe(value => {
        this.updateNodeName(value);
      });
    }

    this.updateNodeConnectionsView();
  }

  updateNodeName(value: string) {
    if (this.isNameDuplicated) {
      this.graphsService.checkNodeNameDuplicates(value, this.node.id as any);
    }
    if (this.isSubgraph && !this.isNameDuplicated) {
      this.graphsService.updateGraph({
        _id: this.nodeData._id,
        name: value,
      } as Graph).subscribe();
    }
    this.nodeData.name = value;
    this.nodeNameControl = null;
    this.updateNodeConnectionsView();
    this.save();
    this.node.update();
  }

  submitNodeNameOnEnter(event: KeyboardEvent) {
    if (event.code === 'Enter' && this.nodeNameControl) {
      this.stopEvent(event);
      this.nodeNameControl.setValue((<any>event.target).value);
    }
  }

  showMore(event: Event) {
    if (this.anchorElement === null) {
      this.anchorElement = event.target;
    } else {
      this.anchorElement = null;
    }
  }

  showSettings(event: Event) {
    this.stopEvent(event);
    this.modalService.openModal('NODE_SETTINGS', {
      nodeId: this.node.id,
      data: this.nodeData,
    });
    this.anchorElement = null;
  }

  updateToLatest(event: Event): void {
    this.stopEvent(event);
    this.anchorElement = null;
    this.subscriptions$.add(this.graphsService.deployNode(this.node.id as any, true, true).subscribe(() => {
      this.nodeData.status = NodeStatus.PENDING;
      this.nodeData.isLatest = true;
      this.node.update();
    }));
  }

  editNodeApplication(event: Event): void {
    this.stopEvent(event);
    const projectId = this.nodeData.project?._id;
    if (projectId) {
      this.applicationBuildService.editApplication(projectId);
    }
    this.anchorElement = null;
  }

  showRequestModal(event: Event) {
    this.stopEvent(event);
    this.editor.trigger(
      // @ts-ignore
      'showcontextmenu', {
        type: 'request',
        data: {
          node: this.nodeData,
          callback: this.saveStoreRequest.bind(this),
        },
      });
    this.anchorElement = null;
  }

  showTrainingSettings(event: Event) {
    this.stopEvent(event);
    this.editor.trigger(
      // @ts-ignore
      'showcontextmenu',
      {
        type: 'training',
        trainingData: {
          ...this.nodeData,
          callback: this.saveTrainingSettings.bind(this),
        },
      });
    this.anchorElement = null;
  }

  showReleases(event: Event) {
    this.stopEvent(event);
    this.editor.trigger(
      // @ts-ignore
      'showcontextmenu',
      {
        type: 'releases',
        data: {
          ...this.nodeData,
          callback: this.saveRelease.bind(this),
        },
      });
    this.anchorElement = null;
  }

  showToolbox(event: Event) {
    this.stopEvent(event);

    this.editingModel = true;
    this.run(() => this.graphEditorService.showToolbox('MODELS', this.node.id as any));
    this.node.update();
  }

  saveNodeSettings(nodeData: any) {
    this.nodeSettings = nodeData.settings;
    this.updateTemplateNode(nodeData);
  }

  saveTrainingSettings(trainingSettings: any) {
    this.trainingsSettings = trainingSettings;
    this.save();
  }

  saveRelease({ isLatest, release }) {
    this.nodeData.isLatest = isLatest;
    if (this.nodeData.status === NodeStatus.RUNNING) {
      this.nodeData.status = NodeStatus.RUNNING_ANOTHER_RELEASE;
    }
    this.graphEditorService.updateNodeInEditor((<any>this.node.id), release, this.editor);

    this.save();
  }

  saveStoreRequest(storeRequest: StoreRequestForm) {
    this.nodeData.storeRequest = {
      _id: (<any>storeRequest)._id,
      nodeStyling: (<any>storeRequest).initial.nodeStyling as any,
    };
    this.node.update();
    this.save();
  }

  onDeleteNode(event: Event) {
    this.stopEvent(event);

    // @ts-ignore
    this.editor.trigger('showcontextmenu', {
      type: 'confirm',
      confirmData: {
        headlineText: `Confirm ${this.nodeData.name || ''} Node deletion`,
        text: `Are you sure you want to delete ${this.nodeData.name || ''} Node?`,
        callback: this.deleteNode.bind(this),
      } as ConfirmData,
    });
    this.anchorElement = null;
  }

  deleteNode() {
    this.editor.removeNode(this.node);
    if (
      this.nodeData.type === this.nodeType.TEMPLATE_NODE &&
      (this.nodeData.storeRequest &&
        !this.nodeData.storeRequest._id ||
        !this.nodeData.storeRequest)
    ) {
      this.nodesService.removeNode(this.nodeData._id);
    }
    if (this.isSubgraph && this.nodeData.type !== this.nodeType.SERVICE) {
      this.graphsService.removeGraph(this.nodeData._id).pipe(take(1)).subscribe(() => {
      });
    }
    this.save();
  }

  deleteModel(event: Event) {
    this.stopEvent(event);
    this.inference.modelId = null;
    this.model = null;
    this.stopEditingModel();
  }

  stopEditingModel() {
    this.editingModel = false;
    this.node.update();
    this.save();
  }

  setActiveIo(event: Event, io: IO) {
    this.stopEvent(event);
    this.nodesService.setActiveIo({
      node: this.node,
      type: io instanceof Input ? 'input' : 'output',
      key: io.key,
    });
  }

  clearActiveIo(event: Event) {
    this.stopEvent(event);
    this.nodesService.clearActiveIo();
  }

  get inference(): { enabled: boolean, modelId: string } {
    return this.nodeData.inference || {} as any;
  }

  set nodeSettings(settings: any) {
    if (this.nodeData) {
      this.nodeData.settings = settings;
    }
  }

  set trainingsSettings(training: any) {
    if (this.nodeData) {
      this.nodeData.training = training;
    }
  }

  /** END OF STANDARD NODE SECTION */
  /** SUB GRAPH IO SECTION */

  setSubGraphIoProperties() {
    this.addIoContext = this.nodeData.subGraphIoType === 'input'
      ? {
        callback: this.addInput.bind(this),
        className: 'node__add-io--right',
        title: 'Add Input',
        placeholder: 'Input Name',
      } : {
        callback: this.addOutput.bind(this),
        className: 'node__add-io--left',
        title: 'Add Output',
        placeholder: 'Output Name',
      };

    this.nodeContainer = this.nodeViewRef.nativeElement.offsetParent;
    this.renderer.addClass(this.nodeContainer, 'node__subgraph-io');
    this.listenToSubGraphFormChange();

    this.nodesService.editorSizeChanged
      .subscribe(height => {
        this.nodeHeight = `${height}px`;
        this.node.update();
      });

    if (this.isServiceSubgraph) {
      this.nodeData.status = NodeStatus.RUNNING;
    }
    this.node.update();
  }

  listenToSubGraphFormChange() {
    this.subscriptions$.add(this.graphsService.graphTemplateFormChanged
      .subscribe(({ name }) => {
        this.nodeData.name = name;
        this.node.update();
      }));
  }

  addInput(event: Event) {
    this.stopEvent(event);
    this.initIoControl();
    this.node.update();
  }

  addOutput(event: Event) {
    this.stopEvent(event);
    this.initIoControl();
    this.node.update();
  }

  deploySubgraph(deploy: boolean): Observable<void> {
    return this.graphsService.deploySubgraph(this.nodeData._id, deploy);
  }

  deployNode(deploy: boolean): Observable<void> {
    return this.graphsService.deployNode(this.node.id as any, deploy);
  }

  deployNodeInstance(deploy: boolean, event: Event): void {
    if (!deploy && this.statusIsPending) {
      return;
    }
    this.stopEvent(event);
    const request$ = this.isSubgraph ? this.deploySubgraph(deploy) : this.deployNode(deploy);
    this.subscriptions$.add(request$.subscribe(() => {
      this.nodeData.status = deploy && !this.isSubgraph && !this.nodeData.isLatest ? NodeStatus.RUNNING_ANOTHER_RELEASE
        : (deploy ? NodeStatus.PENDING : NodeStatus.TERMINATED);

      this.node.update();
    }));
  }

  ioValidator(control: AbstractControl): { [key: string]: any } | null {
    const { value } = control;
    let io: any[];
    if (this.nodeData.subGraphIoType === 'input') {
      io = this.nodeData.outputs || [];
    } else {
      io = this.nodeData.inputs || [];
    }
    const duplicated = io.find(({ name }) => name === value);
    if (duplicated && this.editingIo.key) {
      const { name, id } = getIoMetadataFromKey(this.editingIo.key);
      if (name === value && (id === duplicated.socket || id === duplicated._id)) {
        return null;
      }
    }
    if (duplicated) {
      return {
        duplicate: true,
      };
    }
    return null;
  }

  initIoControl(initValue = null) {
    this.ioControl = new FormControl(
      initValue,
      {
        updateOn: 'blur',
        validators: [
          Validators.required,
          this.ioValidator.bind(this),
        ],
      });
    this.subscriptions$.add(this.ioControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
    ).subscribe(value => {
      if (this.ioControl && this.ioControl.valid) {
        if (this.editingIo && this.editingIo.key) {
          this.saveIo(value);
          return;
        }
        this.addIo(value);
      }
    }));
  }

  submitIoOnEnter(event: KeyboardEvent) {
    if (event.code === 'Enter') {
      this.stopEvent(event);
      const value = (<any>event.target).value;
      this.ioControl.setValue(value);
      this.node.update();
    }
  }

  addIo(name: string) {
    const anyDataSocket = this.socketsService.anyDataSocket;
    const socketMetadataId = new ObjectID().toString();
    const socketId = (<SocketData>anyDataSocket.data).socketId;
    const ioName = `${name}::${socketMetadataId}`;
    if (this.nodeData.subGraphIoType === 'input') {
      const output = new Output(ioName, name, {
        socket: anyDataSocket,
        multiConns: false,
        type: InteractionType.EVENT,
        placement: null,
      });
      this.node.addOutput(output);
      this.nodeIo.push({
        type: IoType.OUTPUT,
        io: output,
        placement: SocketPlacement.RIGHT,
        id: socketMetadataId,
      });
      const outputs = get(this.nodeData, 'outputs', []);
      outputs.push({
        _id: socketMetadataId,
        name,
        socket: socketId,
      } as any);
      this.nodeData.outputs = outputs;
    }
    if (this.nodeData.subGraphIoType === 'output') {
      const input = new Input(ioName, name, {
        socket: anyDataSocket,
        multiConns: false,
        type: InteractionType.EVENT,
        placement: null,
      });
      this.node.addInput(input);
      this.nodeIo.push({
        type: IoType.INPUT,
        io: input,
        placement: SocketPlacement.LEFT,
        id: socketMetadataId,
      });
      const inputs = get(this.nodeData, 'inputs', []);
      inputs.push({
        _id: socketMetadataId,
        name,
        socket: socketId,
      } as any);
      this.nodeData.inputs = inputs;
    }

    this.ioControl = null;
    this.ioControlFocused = false;
    this.node.update();
    this.save();
  }

  stopAddingIo(event: Event) {
    this.stopEvent(event);

    this.ioControl = null;
    this.ioControlFocused = false;
    this.node.update();
  }

  async deleteIo(event, itemIo: NodeIo) {
    const { io, id } = itemIo as any;
    this.stopEvent(event);
    const { name, id: ioId } = getIoMetadataFromKey(io.key);
    io.connections.slice().map(this.editor.removeConnection.bind(this.editor));
    this.nodeIo = this.nodeIo.filter(nodeIo => nodeIo.id !== id);

    if (io instanceof Input) {
      this.node.data.inputs = this.nodeData.inputs.filter(input => input.name !== name && input._id !== ioId);
      this.node.removeInput(io);
    } else {
      this.node.data.outputs = this.nodeData.outputs.filter(output => output.name !== name && output._id !== ioId);
      this.node.removeOutput(io);
    }
    await this.updateNodeConnectionsView();
    this.save();
  }

  goToSubGraph(event: Event) {
    this.stopEvent(event);
    if (this.isSubgraph && !this.readonly && !this.nodeData.disabled) {
      const isService = this.nodeData.service && this.nodeData.type === this.nodeType.SERVICE;
      this.graphsService.goToSubGraph(isService ? this.nodeData.service : this.nodeData._id, isService, this.nodeData.core);
    }
  }

  get isSubGraphIo(): boolean {
    if (this.node && this.nodeData) {
      return !!this.nodeData.subGraphIoType;
    }
  }

  editIo(event: Event, io: IO) {
    if (!this.readonly && this.isSubGraphIo) {
      this.stopEvent(event);
      this.editingIo = io;
      this.initIoControl(io.name);
      this.updateNodeConnectionsView();
    }
  }

  saveIo(value: string) {
    if (this.editingIo instanceof Input) {
      this.updateNodeIoName('inputs', value);
    }
    if (this.editingIo instanceof Output) {
      this.updateNodeIoName('outputs', value);
    }

    this.editingIo = null;
    this.ioControl = null;
    this.ioControlFocused = false;

    this.updateNodeConnectionsView();
    this.node.update();
    this.save();
  }

  updateNodeIoName(ioType: 'inputs' | 'outputs', newIoName) {
    const { name: oldIoName } = getIoMetadataFromKey(this.editingIo.key);
    this.nodeData[ioType] = this.nodeData[ioType].map((io) => {
      if (io.name === oldIoName) {
        return {
          ...io,
          name: newIoName,
        };
      }
      return io;
    });

    this.editingIo.name = newIoName;

    if (this.editingIo.connections.length) {
      for (const connection of this.editingIo.connections) {
        if (ioType === 'inputs') {
          (<ConnectionData>connection.data).target.name = newIoName;
        } else {
          (<ConnectionData>connection.data).source.name = newIoName;
        }
      }
    }
  }

  setIoControlFocused() {
    this.ioControlFocused = true;
  }

  triggerSaveIo(event?: Event) {
    if (event) {
      this.stopEvent(event);
      this.ioControl.setValue((<HTMLInputElement>event.target).value);
      return;
    }
    this.ioControl.setValue(this.ioControl.value);
  }

  stopEditingIo(event: Event, keepEvent?: boolean) {
    if (!keepEvent) {
      this.stopEvent(event);
    }

    this.editingIo = null;
    this.ioControl = null;
    this.ioControlFocused = false;

    this.updateNodeConnectionsView();
  }

  onIoDragStarted() {
    this.ioDragging = true;
  }

  onEndIoDrag(event: CdkDragDrop<NodeIo>) {
    const [removedAtIndex] = this.nodeIo.splice(event.previousIndex, 1);
    this.nodeIo.splice(event.currentIndex, 0, removedAtIndex);
    this.ioDragging = false;
    const ioKey = this.nodeData.subGraphIoType === 'input' ? 'outputs' : 'inputs';

    const [io] = this.nodeData[ioKey].splice(event.previousIndex, 1);
    this.nodeData[ioKey].splice(event.currentIndex, 0, io);
    this.updateNodeConnectionsView();
    this.save();
  }

  /** END OF SUB GRAPH IO SECTION */
  /** TEMPLATE NODE SECTION */

  updateTemplateNode(updatedTemplate: FunctionalNode) {
    this.nodeData.name = updatedTemplate.name;
    this.graphEditorService.updateNodeInEditor((<any>this.node.id), updatedTemplate, this.editor, true, this.isSubgraph);
    this.save();
  }

  /** END OF TEMPLATE NODE SECTION */
  /** MAPPING SECTION */
  createMappingIo(): void {
    const mappingIoConfig = {
      type: InteractionType.EVENT,
      isMappingIo: true,
      socket: this.socketsService.anyDataSocket,
    } as IoConfig;
    this.mappingIo = Object.keys(IoType).map((ioType: any) => new MappingIo(
      [
        this.createIo(ioType, {
          ...mappingIoConfig,
          placement: ioType === IoType.INPUT ? null : SocketPlacement.LEFT,
          multiConns: ioType === IoType.OUTPUT,
        }, this.sharedService.uuidv4Generator(), '') as any,
        this.createIo(ioType, {
          ...mappingIoConfig,
          placement: ioType === IoType.OUTPUT ? null : SocketPlacement.RIGHT,
          multiConns: ioType === IoType.OUTPUT,
        }, this.sharedService.uuidv4Generator(), '') as any,
      ],
      ioType,
      SocketPlacement.CENTER,
      null,
      false,
    ));
  }

  showAvailableMappingIo(): void {
    const { ioType } = this.connectionPickData;
    const availableIo = this.mappingIo.find(({ type }) => type === ioType);
    if (availableIo) {
      availableIo.activeLeft = true;
      availableIo.activeRight = true;
    }
  }

  hideAvailableMappingIo(): void {
    let checkArray = [];
    const { connectionData } = this.connectionPickData;
    if (connectionData) {
      checkArray = [connectionData?.inputKey, connectionData?.outputKey];
    }
    for (const mappingItem of this.mappingIo) {
      const [leftSideIo, rightSideIo] = mappingItem.io as any;
      if (!checkArray.includes(leftSideIo.key)) {
        mappingItem.activeLeft = false;
      }
      if (!checkArray.includes(rightSideIo.key)) {
        mappingItem.activeRight = false;
      }
    }
  }

  /** END OF MAPPING SECTION */
  createIo(type: IoType, config: IoConfig, key: string, title = ''): Input | Output {
    const io = type === IoType.INPUT ? Input : Output;
    const newIo = new io(key, title, config);
    this.node[type === IoType.INPUT ? 'addInput' : 'addOutput'](newIo as any);
    return newIo;
  }

  removeIo(io: Input | Output): void {
    if (io instanceof Input) {
      this.node.removeInput(io);
    } else {
      this.node.removeOutput(io);
    }
  }

  goToApplication(): void {
    window.open(`${environment.production ? '/system-graph' : ''}/applications/${this.nodeData?.project?._id}/${this.node.id}`, '_blank');
  }

  getReferenceName(): Observable<string> {
    return this.referenceName$?.pipe(map(ref => {
      return `${titleCase(ref?.name)}${this.isDeviceNode && this.nodeData?.project?.name ? ` (driver: ${titleCase(this.nodeData.project?.name)})` : ''}`;
    }));
  }

  get isNodeOwner(): boolean {
    return (this.node as any)?.data?.project?.user === this.currentUser._id;
  }

  get nodeData(): NodeData {
    if (this.node && this.node.data) {
      return <NodeData><unknown>this.node.data;
    }
    return null;
  }

  get readonly(): boolean {
    return this.graphsService.graphType === GraphType.LINKED;
  }

  get statusIsRunning(): boolean {
    return this.nodeData.status === NodeStatus.RUNNING || this.isRunningOnAnotherRelease || this.isServiceNode;
  }

  get statusIsPending(): boolean {
    return this.nodeData.status === NodeStatus.PENDING;
  }

  get statusIsError(): boolean {
    return !this.nodeData.disabled && this.nodeData.status === NodeStatus.ERROR;
  }

  get statusIsIdle(): boolean {
    return this.nodeData.status === NodeStatus.TERMINATED || this.nodeData.status === NodeStatus.SAVED;
  }

  get isApp(): boolean {
    return this.nodeData?.project?.projectType === 'APP';
  }

  get serviceDisabled(): boolean {
    return this.nodeData.type === this.nodeType.SERVICE && this.nodeData.disabled;
  }

  get isDeviceNode(): boolean {
    return this.nodeData.type === this.nodeType.DEVICE_NODE || this.nodeData.project?.projectType === this.nodeType.DEVICE_NODE;
  }

  get isServiceNode(): boolean {
    return this.nodeData.type === this.nodeType.SERVICE_NODE;
  }

  get isTemplateNode(): boolean {
    return this.nodeData.type === this.nodeType.TEMPLATE_NODE;
  }

  get isBridge(): boolean {
    return this.nodeData.device?.bridgeMode && this.nodeData?.type === this.nodeType.DEVICE_NODE;
  }

  get isControllerNode(): boolean {
    return this.nodeData.device?.isController && this.nodeData?.type === this.nodeType.USER_NODE &&
      this.nodeData.project.projectType === NodeType.DEVICE_NODE;
  }

  get isRunningOnAnotherRelease(): boolean {
    return this.nodeData.status === NodeStatus.RUNNING_ANOTHER_RELEASE;
  }

  get isServiceSubgraph(): boolean {
    return this.nodeData.type === this.nodeType.SERVICE;
  }

  get isCoreNode(): boolean {
    return this.nodeData.type === this.nodeType.CORE_NODE;
  }

  get isUserNode(): boolean {
    return this.nodeData.type === this.nodeType.USER_NODE;
  }

  get isRobotAppNode(): boolean {
    return this.nodeData?.project?.projectType === this.nodeType.ROBOT && this.nodeData.project.runtime === 'AOS';
  }

  get isAOSNode(): boolean {
    return this.nodeData?.project?.projectType === this.nodeType.COMPUTE_NODE && this.nodeData.project.runtime === 'AOS';
  }

  get isAOSApp(): boolean {
    return this.nodeData?.project?.projectType === this.nodeType.APP && this.nodeData.project.runtime === 'AOS';
  }

  get isSubgraph(): boolean {
    return this.nodeData.type === this.nodeType.LINKED ||
      this.nodeData.type === this.nodeType.SERVICE ||
      this.nodeData.type === this.nodeType.SUBGRAPH;
  }

  get isSubgraphEmpty(): boolean {
    return  this.nodeData.type === this.nodeType.SUBGRAPH &&
            !this.nodeData?.statuses?.EMPTY &&
            !this.nodeData?.statuses?.RUNNING &&
            !this.nodeData?.statuses?.ERROR &&
            !this.nodeData?.statuses?.PENDING &&
            !this.nodeData?.statuses?.STOPPED
  }

  get isProjectSubgraph(): boolean {
    return this.nodeData.type === this.nodeType.SUBGRAPH && this.nodeData.subType === Graph.SubTypeEnum.SPECIAL;
  }

  get isInformationNode(): boolean {
    return this.nodeData.type === this.nodeType.IMAGE || this.nodeData.type === this.nodeType.TEXTAREA;
  }

  get isStopped(): boolean {
    return this.nodeData.status === NodeStatus.SAVED ||
      this.nodeData.status === NodeStatus.TERMINATED ||
      this.nodeData.status === NodeStatus.CREATED;
  }

  get isReference(): boolean {
    return !!this.nodeData.reference || this.nodeData.type === NodeType.DEVICE_NODE;
  }

  get nodeStyling() {
    const styles = {} as any;
    if (this.nodeHeight) {
      styles.height = this.nodeHeight;
    }
    if (this.nodeData.storeRequest && this.nodeData.storeRequest.nodeStyling) {
      styles.background = this.nodeData.storeRequest.nodeStyling.backgroundColor;
      styles.border = `1px solid ${this.nodeData.storeRequest.nodeStyling.borderColor}`;
    }
    return styles;
  }

  get hasDisconnectedInput(): boolean {
    return this.nodeIo.some(io => io.type === IoType.INPUT);
  }

  get hasDisconnectedOutput(): boolean {
    return this.nodeIo.some(io => io.type === IoType.OUTPUT);
  }

  get hasIO(): boolean {
    return !!this.nodeIo?.length;
  }

  get name(): Observable<string> {
    let name = titleCase(this.nodeData?.name);

    if (this.isReference && !this.isDeviceInsideControllerSubgraph && !this.isProjectSubgraph && !this.isDeviceNode) {
      return this.getReferenceName();
    }

    if (this.isServiceNode) {
      name = titleCase(name?.replace('_', ' '));
    }

    if (this.isDeviceInsideControllerSubgraph || this.isDeviceNode) {
      name = `${titleCase(this.nodeData.device?.name)}${this.isDeviceNode && this.nodeData?.project?.name
        ? ` (driver: ${titleCase(this.nodeData.project?.name)})` : ''}`;
    }
    return of(name);
  }

  get isDeviceInsideControllerSubgraph(): boolean {
    return this.nodeData?.project?.projectType === NodeType.DEVICE_NODE
      && this.graph?.subType === Graph.SubTypeEnum.CONTROLLER && this.nodeData?.device;
  }

  get nodeSubTitle(): string {
    if (this.isControllerNode) {
      return 'Controller';
    }

    if (this.isAOSNode) {
      return 'AOS Node';
    }

    if (this.isRobotAppNode) {
      return 'Robot Application Node';
    }

    if (this.nodeData.subType) {
      return `${this.nodeData.subType} sub-graph`;
    }
    if (this.nodeData.type === GraphType.SUBGRAPH) {
      return 'Sub-graph';
    }
    if (this.nodeData.type === GraphType.SERVICE) {
      return 'Service Sub-graph';
    }
    if (this.nodeData.type === Graph.SubTypeEnum.CONTROLLER) {
      return 'Controller Sub-graph';
    }
    if (this.nodeData.type === NodeType.TEMPLATE_NODE) {
      return 'provisional node';
    }
    if (this.nodeData?.project?.projectSubType) {
      if (this.nodeData?.project?.projectSubType === ApplicationType.APPLICATION) {
        return 'Application Node';
      } else {
        return `${this.nodeData?.project?.projectSubType} application`;
      }
    }
    if (this.isDeviceNode) {
      return 'device node';
    }
    if (this.isServiceNode) {
      return `${this.graph?.subType === Graph.SubTypeEnum.SPECIAL ? 'project' : 'service'} node`;
    }
    return this.nodeData?.graphNode?.release?.name || this.nodeData?.templateName;
  }

  run(func: any) {
    this.ngZone.run(() => func());
  }

  save(): void {
    this.editor.trigger('save');
  }

  async updateNodeConnectionsView() {
    await this.node.update();
    this.editor.view.updateConnections({ node: this.node });
    this.nodesService.updateEditorView(this.node);
  }

  ngOnDestroy(): void {
    try {
      this.subscriptions$.unsubscribe();
    } catch {
    }
  }
}
