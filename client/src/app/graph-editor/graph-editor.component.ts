import {
  DriveUploaderComponent,
  GraphType,
  ModalService,
  NodeStatus,
  NodeType
} from '@aitheon/core-client';
import {
  Connection,
  Engine,
  Input as NodeInput,
  InteractionType,
  NodeEditor,
  Output as NodeOutput,
} from '@aitheon/lib-graph';
import AreaPlugin from '@aitheon/lib-graph-area-plugin';
import ConnectionPlugin from '@aitheon/lib-graph-connection-plugin';
import ContextMenuPlugin from '@aitheon/lib-graph-context-menu-plugin';
import ConnectionExtensionPlugin from '@aitheon/lib-graph-extension-plugin';
import HistoryPlugin from '@aitheon/lib-graph-history-plugin';
import ReadonlyPlugin from '@aitheon/lib-graph-readonly-plugin';
import { ComponentData, RenderPlugin } from '@aitheon/lib-graph-render-plugin';
import { Data } from '@aitheon/lib-graph/types/core/data';
import { FileItem, Graph } from '@aitheon/system-graph';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
} from '@angular/core';

import { ToastrService } from 'ngx-toastr';

import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GraphsService } from '../graphs/graphs.service';
import { IoType } from '../shared/enums/io-type.enum';
import { ConnectionData } from '../shared/interfaces/connection-data.interface';
import { IoData } from '../shared/interfaces/io-data.interface';
import { MappingModalData } from '../shared/interfaces/mapping-modal-data.interface';
import { NodeModel } from '../shared/models/node.model';
import { OrganizationsService } from '../shared/services/organizations.service';
import { SharedService } from '../shared/services/shared.service';

import { get } from '../shared/utils/get';
import { ImageNodeComponent } from './components/image-node/image-node.component';
import { InformationNodeConstructor } from './components/information-node.constructor';
import { MappingConstructorComponent } from './components/mapping-constructor.component';
import { MappingNodeComponent } from './components/mapping-node/mapping-node.component';
import { NodeConstructorComponent } from './components/node-constructor.component';
import { NodeComponent } from './components/node/node.component';
import { ReleasesModalComponent } from './components/releases-modal/releases-modal.component';
import { StoreRequestModalComponent } from './components/store-request-modal/store-request-modal.component';
import { TrainingSettingsModalComponent } from './components/training-settings-modal/training-settings.component';
import { GraphEditorService } from './shared/services/graph-editor.service';
import { NodesService } from './shared/services/nodes.service';
import { SocketsService } from './shared/services/sockets.service';
import { getIoMetadataFromKey } from './shared/utils/get-io-metadata-from-key';

const components: ComponentData[] = [
  {
    name: 'node',
    component: NodeComponent,
    constructor: NodeConstructorComponent,
  },
  {
    name: 'mapping',
    component: MappingNodeComponent,
    constructor: MappingConstructorComponent,
  },
  {
    name: 'image',
    component: ImageNodeComponent,
    constructor: InformationNodeConstructor,
  }
];

@Component({
  selector: 'ai-graph-editor',
  templateUrl: './graph-editor.component.html',
  styleUrls: ['./graph-editor.component.scss'],
})
export class GraphEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('nodeEditor') el: ElementRef;
  @ViewChild('trainingSettingsModal') trainingSettingsModal: TrainingSettingsModalComponent;
  @ViewChild('releasesModal') releasesModal: ReleasesModalComponent;
  @ViewChild('requestModal') requestModal: StoreRequestModalComponent;
  @ViewChild('driveUploader') driveUploader: DriveUploaderComponent;
  @ViewChild('uploadFileInput') uploadFileInput: ElementRef<HTMLInputElement>;

  @Input() data: Data;
  subscriptions$ = new Subscription();
  editor: NodeEditor;
  engine: Engine;
  showToolbox = false;
  translated: boolean;
  transform: {
    x: number,
    y: number,
    k: number,
  };
  currentOrganization: {
    [key: string]: any;
    _id: string;
  };
  serviceKey: {
    key: string;
    _id: string;
  } = {
    key: null,
    _id: 'SYSTEM_GRAPH',
  };
  selectedNodeId: string;
  allowedMimeType = [
    'image/jpeg',
    'image/png',
  ];
  editorObserver: MutationObserver;
  editorWidth: number;
  showHint = false;

  constructor(
    private ngZone: NgZone,
    private socketsService: SocketsService,
    private sharedService: SharedService,
    private nodesService: NodesService,
    private graphEditorService: GraphEditorService,
    private modalService: ModalService,
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef,
    private organizationsService: OrganizationsService,
    public graphsService: GraphsService,
    public toastr: ToastrService
  ) {}

  @HostListener('window:resize', ['$event'])
  onResizeWindow(event) {
    if (event.target.innerHeight < 870) {
      document.querySelector('.toolbox')?.classList.add('toolbox--small');
    } else {
      document.querySelector('.toolbox')?.classList.remove('toolbox--small');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent) {
    if (this.editor?.selectedConnections?.length) {
      if (['Backspace', 'Delete'].includes(event.code)) {
        this.editor.removeSelectedConnections();
      }
    }
  }

  ngOnInit(): void {
    this.organizationsService.currentOrganization$.pipe(take(1)).subscribe((organization) => {
      this.currentOrganization = organization;
      this.serviceKey.key = this.currentOrganization._id;
    });
    this.listenToUploaderCall();
    this.listenForNodeImage();
  }

  async updateEditor(data: any) {
    if (data) {
      await this.ngZone.runOutsideAngular(async () => {
        await this.editor.fromJSON(data);
        this.editor.trigger('process');
        this.cdr.detectChanges();
        if (this.graphsService.getGraph().type !== GraphType.ORGANIZATION) {
          if (this.transform) {
            this.pickSubGraphNodes(this.transform);
          }
        }
      });
    }
  }

  public getEditorData() {
    return this.editor && this.editor.toJSON();
  }

  public resize() {
    this.delay.then(() => {
      this.editor.view.resize();
      AreaPlugin.zoomAt(this.editor, this.editor.nodes);
    });
  }

  ngAfterViewInit() {
    if (environment.production) {
      this.initGraphEditor();
    } else {
      this.ngZone.runOutsideAngular(() => {
        this.initGraphEditor();
      });
    }

    if (window.innerHeight < 870) {
      document.querySelector('.toolbox')?.classList.add('toolbox--small');
    } else {
      document.querySelector('.toolbox')?.classList.remove('toolbox--small');
    }
  }

  async initGraphEditor() {
    const container = this.el.nativeElement;

    this.editor = new NodeEditor(GraphsService.editorId, container);
    this.editor.use(ConnectionPlugin);
    this.editor.use(HistoryPlugin, { keyboard: true, initOnReady: true });

    this.editor.use(AreaPlugin, {
        backgroundClass: this.graphsService.graphType === GraphType.ORGANIZATION ? 'graph-editor-background--gold' : null,
        background: true,
        snap: false,
        scaleExtent: {
          min: 0.3,
          max: 1.3,
        },
      } as any,
    );

    this.editor.use(ContextMenuPlugin);
    this.editor.use(RenderPlugin, { components });
    this.editor.use(ReadonlyPlugin, { enabled: this.readonly });
    this.editor.use(ConnectionExtensionPlugin, {
      curve: ConnectionExtensionPlugin.curveBundle,
      curvature: 0.1
    });

    this.engine = new Engine(GraphsService.editorId);

    for (const { constructor, name } of components) {
      const nodeConstructor = new constructor(name === 'image' ? name : this.socketsService);
      this.editor.register(nodeConstructor);
      this.engine.register(nodeConstructor);
    }

    this.setListeners();

    this.editor.trigger('process');
    this.resize();

    this.graphEditorService.editor = this.editor;
  }

  setListeners() {
    this.onEditorResize();
    this.listenToToolboxStatus();
    this.listenToGraphChange();
    this.listenToNodeUpdate();
    this.listenToDataUpdate();
    this.onShowContextMenu();
    this.disableDoubleClick();
    this.setConnectionsColors();
    this.onConnectionCreate();
    this.onConnectionCreated();
    this.onConnectionRemoved();
    this.onConnectionDrop();
    this.onPickConnection();
    this.onTranslate();
    this.onNodeTranslate();
    this.onNodeTranslated();
    this.onZoom();
    this.onHistoryChange();
    this.autoSave();

    this.editor.on([
      'process',
      'nodecreated',
      'noderemoved',
      'rendersocket',
      'connectioncreated',
      'connectionremoved',
    ], (async () => {
      if (this.editor.silent) {
        return;
      }
      await this.engine.abort();
      await this.engine.process(this.editor.toJSON());
    }) as any);
  }

  autoSave() {
    // @ts-ignore
    this.editor.on('save', () => {
      this.run(this.graphsService.triggerSave);
      return false;
    });
  }

  onNodeTranslate() {
    this.editor.on('nodetranslate', ({ node, x, y }) => {
      if (node.data.subGraphIoType) {
        return false;
      }
      this.translated = true;
    });
  }

  onNodeTranslated() {
    this.editor.on('nodedraged', data => {
      if (this.translated) {
        this.translated = false;
        this.save();
      }
    });
  }

  private listenToUploaderCall(): void {
    this.subscriptions$.add(this.nodesService.openFileUploader$.subscribe((data) => {
      this.selectedNodeId = data?.nodeId;
      this.uploadFileInput.nativeElement.click();
    }));
  }

  listenForNodeImage() {
    this.sharedService.getImageFromNode().subscribe(res => {
      this.modalService.openModal('FILE_VIEWER', res);
    });
  }

  save() {
    this.editor.trigger('save');
  }

  onTranslate() {
    this.editor.on('translate', ({ transform, x, y }) => {
      this.pickSubGraphNodes({ x, y, k: transform.k });
    });
  }

  onZoom() {
    this.editor.on('zoom', async (data) => {
      const view = await this.editor.view;
      const editorHeight = view.container.offsetHeight;
      this.pickSubGraphNodes(view.area.transform, editorHeight);
    });
  }

  onHistoryChange(): void {
    this.editor.on(['undo', 'redo'] as any, () => {
      this.save();
    });
  }

  onZoomButtons(action: 'INCREASE' | 'DECREASE') {
    const { area } = this.editor.view;
    const updatedK = action === 'INCREASE' ? area.transform.k + 0.03 : area.transform.k - 0.03;
    const rect = area.el.getBoundingClientRect();

    action === 'INCREASE'
      ? area.zoom(updatedK, (rect.width * 0.03), (rect.height * 0.03), 'touch')
      : area.zoom(updatedK, (rect.width * 0.000001 - 20), (rect.height * 0.000001), 'touch');

    area.update();
  }

  pickSubGraphNodes(data, editorHeight?: number) {
    this.transform = data;
    const { x, y, k } = data;
    let inputNode, outputNode = null;
    this.editor.view.nodes.forEach(item => {
      if (item.node.data.subGraphIoType === 'input') {
        inputNode = item;
      }
      if (item.node.data.subGraphIoType === 'output') {
        outputNode = item;
      }
    });
    if (inputNode && outputNode) {
      const coefficient = 1 / k;

      const inputNodeEl = inputNode.el;
      const nodesY = (y > 0 ? -y : y) * coefficient;
      let inputNodeX = (x > 0 ? -x : x) * coefficient;
      inputNodeX = x < 0 ? -inputNodeX : inputNodeX;
      inputNode.node.position = [inputNodeX, y < 0 ? -nodesY : nodesY];
      this.renderer.setStyle(
        inputNodeEl,
        'transform',
        `translate(${inputNodeX}px, ${y < 0 ? -nodesY : nodesY}px)`,
      );

      const editorWindowWidth = this.editor.view.area.el.offsetWidth;

      //  subgraph io node width.
      const nodeWidth = 180;
      const outputNodeX = inputNodeX + (editorWindowWidth * coefficient) - nodeWidth;
      const outputNodeEl = outputNode.el;
      outputNode.node.position = [outputNodeX, y < 0 ? -nodesY : nodesY];
      this.renderer.setStyle(
        outputNodeEl,
        'transform',
        `translate(${outputNodeX}px, ${y < 0 ? -nodesY : nodesY}px)`,
      );
      this.editor.view.updateConnections({ node: inputNode.node });
      this.editor.view.updateConnections({ node: outputNode.node });
      if (editorHeight) {
        this.nodesService.onChangeEditorHeight(editorHeight * coefficient);
      }
    }
  }

  listenToGraphChange() {
    this.subscriptions$.add(this.graphsService.graphChanged$.subscribe(async graph => {
      if (graph && graph.type as any !== GraphType.LINKED) {
        const readonlyEnabled = this.editor.trigger('isreadonly');
        if (readonlyEnabled) {
          this.editor.trigger('readonly', false);
          await this.engine.abort();
          await this.engine.process(this.editor.toJSON());
        }
      }
    }));
  }

  listenToNodeUpdate() {
    this.subscriptions$.add(this.nodesService.updateReteEditor
      .subscribe(async (node) => {
        try {
          this.editor.view.updateConnections({ node });
        } catch (e) {
        }
        this.editor.trigger('process');
      }));
  }

  onConnectionDrop() {
    this.editor.on('connectiondrop', async io => {
      const activeIo = this.nodesService.getActiveIo();
      if (activeIo) {
        let inputNode, outputNode, input, output;
        if (io instanceof NodeOutput) {
          input = activeIo;
          inputNode = activeIo.node;
          outputNode = io.node;
          output = io;
        } else {
          input = io;
          inputNode = io.node;
          outputNode = activeIo.node;
          output = activeIo;
        }
        if (
          io instanceof NodeOutput && activeIo.type === 'input' ||
          io instanceof NodeInput && activeIo.type === 'output'
        ) {
          await this.editor.connect(outputNode.outputs.get(output.key), inputNode.inputs.get(input.key));
          await this.editor.trigger('resetconnection');
          this.nodesService.clearActiveIo();
        }
      }
      this.nodesService.connectionDropped({ nodeId: null, ioType: null, socket: null });
    });
  }

  onConnectionCreate() {
    this.editor.on('connectioncreate', ({ input, output }) => {
      if (input.node.data.subGraphIoType && output.node.data.subGraphIoType) {
        this.run(() => {
          this.toastr.error('Can\'t to connect directly sub graph IO');
        });
        return false;
      }
      const isSocketsCompatible = this.socketsService.isSocketsCompatible(input.socket, output.socket);
      if (!isSocketsCompatible) {
        this.run(() => {
          this.showMappingNodeCreationConfirm(input, output);
          this.nodesService.connectionDropped();
        });
      }
    });
  }

  onConnectionCreated() {
    this.editor.on('connectioncreated', connection => {
      const { input, output, data } = connection as any;
      const { name: inputName, id: inputMetadataId, placement: inputEntryPoint } = getIoMetadataFromKey(input.key);
      const { name: outputName, id: outputMetadataId, placement: outputEntryPoint } = getIoMetadataFromKey(output.key);
      const inputSocketId = input.socket.data.socketId;
      const outputSocketId = output.socket.data.socketId;

      let ioIsAnyData = null;
      const anyDataSocketId = this.socketsService.anySocketId;
      const graph = this.graphsService.getGraph() || {} as any;
      if (graph.type && graph.type !== GraphType.ORGANIZATION) {
        if (inputSocketId === anyDataSocketId) {
          ioIsAnyData = 'input';
        }
        if (outputSocketId === anyDataSocketId) {
          ioIsAnyData = 'output';
        }
      }

      const connectionType = (input.socket.data.responseSocketId || output.socket.data.responseSocketId)
        ? InteractionType.CHANNEL
        : InteractionType.EVENT;

      const source = {
        nodeId: output.node.id,
        name: outputName,
        metadataId: outputMetadataId,
        entryPoint: outputEntryPoint,
        socketId: ioIsAnyData === 'output' ? inputSocketId : outputSocketId,
        placement: output.placement,
        responseSocketId: output.socket.data.responseSocketId
      } as IoData;
      const target = {
        nodeId: input.node.id,
        name: inputName,
        metadataId: inputMetadataId,
        entryPoint: inputEntryPoint,
        socketId: ioIsAnyData === 'input' ? outputSocketId : inputSocketId,
        placement: input.placement,
        responseSocketId: input.socket.data.responseSocketId,
      } as IoData;
      data.source = source;
      data.target = target;
      data.type = connectionType;

      this.showDataFlow();
      if (ioIsAnyData) {
        this.replaceSubgraphIoSocket(
          connection,
          ioIsAnyData,
          {
            metadataId: ioIsAnyData === 'input' ? inputMetadataId : outputMetadataId,
            socketId: ioIsAnyData === 'input' ? outputSocketId : inputSocketId,
            responseSocketId: input.socket.data.responseSocketId || output.socket.data.responseSocketId,
          },
        );
      }

      this.nodesService.connectionDropped({
        nodeId: null,
        ioType: null,
        socket: null,
        connectionData: (input.isMappingIo || output.isMappingIo) ? {
          inputKey: input.key,
          outputKey: output.key
        } : null,
      });

      if (connection.input.isMappingIo !== connection.output.isMappingIo) {
        this.editor.removeConnection(connection);
        return;
      }

      if (input.isMappingIo && output.isMappingIo) {
        this.openMappingModal(connection);
        return;
      }

      const isAlreadyCreated = this.graphsService.isConnectionAlreadyCreated(data);
      if (!isAlreadyCreated) {
        this.save();
      }
    });
  }

  showMappingNodeCreationConfirm(input: NodeInput, output: NodeOutput): void {
    this.modalService.openGenericConfirm({
      text: 'Nodes IO are not compatible, you can create Mapping Node to connect them',
      headlineText: 'IO are not compatible',
      confirmText: 'create mapping node',
      callback: confirm => {
        if (confirm) {
          this.openMappingModal({
            output,
            input,
          } as any, true);
        }
      }
    });
  }

  openMappingModal(connection: Connection, isIoSelected?: boolean): void {
    this.run(() => {
      const modalData = {
        isExist: false,
        inputNodeData: connection.input.node.data as any,
        outputNodeData: connection.output.node.data as any,
        inputNodeId: connection.input.node.id as any,
        outputNodeId: connection.output.node.id as any,
      } as MappingModalData;
      if (isIoSelected) {
        modalData.inputId = getIoMetadataFromKey(connection.input.key)?.id;
        modalData.outputId = getIoMetadataFromKey(connection.output.key)?.id;
        modalData.isIoSelected = true;
      }
      this.modalService.openModal('MAPPING_MODAL', modalData);
    });
  }

  onConnectionRemoved() {
    this.editor.on('connectionremoved', (connection) => {
      const connectionData = connection.data as ConnectionData;
      this.nodesService.connectionPicked({
        nodeId: connectionData.source.nodeId,
        ioType: IoType.INPUT,
        socket: connection.input.socket,
      });
      this.save();
    });
  }

  setConnectionsColors() {
    this.editor.on([
      'renderconnection',
      'process',
    ], () => {
      this.showDataFlow();
    });
  }

  showDataFlow() {
    this.editor.view.connections.forEach(connectionView => {
      const path = connectionView.el.querySelector('path');
      const inputNodeData = get(connectionView, 'inputNode.node.data');
      const outputNodeData = get(connectionView, 'outputNode.node.data');

      const showDataFlow = (inputNodeData.status === NodeStatus.RUNNING || inputNodeData.subGraphIoType) &&
        (outputNodeData.status === NodeStatus.RUNNING || outputNodeData.subGraphIoType);
      const circle = connectionView.el.querySelector('circle');
      if (circle && !showDataFlow) {
        this.renderer.removeChild(circle.parentElement, circle);
        this.renderer.setStyle(path, 'stroke', this.graphEditorService.statusesColors.disabled);
      }

      if (!circle && showDataFlow) {
        const svg = connectionView.el.querySelector('svg');
        const id = this.sharedService.uuidv4Generator();
        this.renderer.setAttribute(path, 'id', id);

        const inputSocketData = get(connectionView, 'connection.input.socket.data');
        const outputSocketData = get(connectionView, 'connection.output.socket.data');
        let color;
        if (inputSocketData.isAnyData) {
          color = outputSocketData.color;
        } else {
          color = inputSocketData.color;
        }

        const marker = this.createDataFlowMarker(color, id);
        this.renderer.appendChild(svg, marker);
        this.renderer.setStyle(path, 'stroke', color);
      }
    });
  }

  createDataFlowMarker(color: string, id: string): SVGCircleElement {
    const beginAnimation = Math.floor(Math.random() * 60);
    const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');

    animateMotion.addEventListener('beginEvent', () => {
      this.renderer.setStyle(marker, 'display', 'block');
    });

    animateMotion.addEventListener('repeatEvent', () => {
      if (Math.random() >= 0.95) {
        this.renderer.setStyle(marker, 'display', 'block');
        return;
      }
      this.renderer.setStyle(marker, 'display', 'none');
    });

    this.renderer.setAttribute(animateMotion, 'dur', '2s');
    this.renderer.setAttribute(animateMotion, 'begin', `${beginAnimation}s`);
    this.renderer.setAttribute(animateMotion, 'repeatCount', 'indefinite');


    const mPath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    this.renderer.setAttribute(mPath, 'href', `#${id}`);
    this.renderer.appendChild(animateMotion, mPath);

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.renderer.setStyle(marker, 'display', 'none');
    this.renderer.setAttribute(marker, 'r', '5');
    this.renderer.setAttribute(marker, 'fill', color);
    this.renderer.appendChild(marker, animateMotion);

    return marker;
  }

  replaceSubgraphIoSocket(
    connection: Connection,
    type: 'input' | 'output',
    socketData: {
      socketId: string,
      metadataId: string,
      responseSocketId: string,
    }) {
    const targetNode = connection[type].node as unknown as NodeModel;
    const ioKey = type === 'input' ? 'inputs' : 'outputs';
    const io = targetNode.data[ioKey] as any[];
    if (socketData.responseSocketId) {
      const targetIo = io.find(({ _id }) => _id === socketData.metadataId);

      if (targetIo) {
        targetIo.multiple = type === 'output';
        targetIo.type = type === 'input' ? 'client' : 'server';
        targetIo.responseSocket = socketData.responseSocketId as any;
        targetIo.socket = socketData.socketId as any;
        connection[type].setInteractionType(InteractionType.CHANNEL);
      }
      return;
    }
    if (io) {
      targetNode.data[ioKey] = io?.map(socket => {
        if (socket._id === socketData.metadataId) {
          return {
            ...socket,
            socket: socketData.socketId,
          };
        }
        return socket;
      });
    }
  }

  onShowContextMenu() {
    // TODO rework this with service approach
    // @ts-ignore
    this.editor.on(['showcontextmenu'], (params: any) => {
      const { type } = params;
      switch (type) {
        case 'request':
          this.requestModal.show(params.data);
          break;
        case 'confirm':
          this.modalService.openGenericConfirm(params.confirmData);
          break;
        case 'training':
          this.trainingSettingsModal.show(params.trainingData);
          break;
        case 'releases':
          this.releasesModal.show(params.data);
          break;
        default:
          /** disable context menu */
          return false;
      }
    });
  }

  onPickConnection() {
    this.editor.on(['connectionpick'], data => {
      this.nodesService.connectionPicked({
        nodeId: data.node.id as any,
        ioType: data instanceof NodeInput ? IoType.OUTPUT : IoType.INPUT,
        socket: data.socket,
        isMappingIo: data.isMappingIo,
      });
    });
  }

  disableDoubleClick() {
    this.editor.on('zoom', ({ source }) => {
      return source !== 'dblclick';
    });
  }

  allowDroppingNode(event: Event) {
    event.preventDefault();
  }

  onNodeDrop(event: DragEvent) {
    try {
      event.preventDefault();
      const node = JSON.parse(event.dataTransfer.getData('node'));
      const offset = JSON.parse(event.dataTransfer.getData('offset'));
      if (!node || !offset) {
        return;
      }

      const dropCoordinates = {
        clientX: event.clientX,
        clientY: event.clientY,
      };

      if (node.type === NodeType.TEMPLATE_NODE && !node.requested) {
        this.nodesService.createNode(node).subscribe(createdNode => {
            this.graphEditorService.addNodeToEditor(createdNode, offset, dropCoordinates);
          },
          error => {
            this.run(() => {
              this.toastr.error(error.message || 'Unable to create node template');
            });
          });
        return;
      }
      if (node.type === GraphType.SUBGRAPH) {
        this.graphsService.createGraph(node, true).subscribe((createdGraph: Graph) => {
          this.graphEditorService.addNodeToEditor(createdGraph as any, offset, dropCoordinates);
        });
        return;
      }

      if (node.type === NodeType.IMAGE) {
        node.position = this.graphEditorService.getNodePosition(offset, dropCoordinates);
        this.graphEditorService.addInformationNodes([node], true);
        return;
      }
      this.graphEditorService.addNodeToEditor(node, offset, dropCoordinates);
    } catch (e) {
      console.log(e);
    }
  }

  listenToDataUpdate() {
    this.subscriptions$.add(this.graphEditorService.updateEditor$
      .subscribe(data => {
        this.updateEditor(data);
      }));
  }

  onEditorResize(): void {
    this.editorWidth = this.el.nativeElement.offsetWidth;
    this.editorObserver = new MutationObserver((mutations: MutationRecord[]) => {
      const editorMutation: MutationRecord = mutations[0];
      const newEditorWidth = (editorMutation.target as any).offsetWidth;
      if (newEditorWidth !== this.editorWidth) {
        const view = this.editor.view;
        if (view && view.area?.transform) {
          this.pickSubGraphNodes(view.area.transform);
        }
      }
    });
    this.editorObserver.observe(this.el.nativeElement, {
      attributes: true,
    });
  }

  listenToToolboxStatus() {
    this.subscriptions$.add(this.graphEditorService.onShowToolbox
      .subscribe(() => {
        this.showToolbox = true;
      }));
    this.subscriptions$.add(this.graphEditorService.onHideToolbox
      .subscribe(() => {
        this.showToolbox = false;
        this.resize();
      }));
  }

  get delay() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  public get readonly() {
    return this.graphsService.graphType === GraphType.LINKED;
  }

  run(func: any) {
    this.ngZone.run(() => func());
  }

  public onUploadFail(): void {
    this.toastr.error('Image upload failed');
  }

  public onSuccessUpload(file: FileItem): void {
    const fileToSave = {
      name: file.name,
      contentType: file.contentType,
      signedUrl: file.signedUrl,
    } as FileItem;
    this.nodesService.fileUploaded(this.selectedNodeId, fileToSave);
  }

  onAfterAddImage(e: any): void {
    let sizeNotAllowed = false;
    let typeNotAllowed = false;
    let errorMessage = '';
    if (!(e.file.size / 1000 / 1000 < 3)) {
      sizeNotAllowed = true;
      errorMessage = 'File size limit exceeded, should be less than 3 MB.';
    }
    if (!this.allowedMimeType.includes(e.file.type)) {
      typeNotAllowed = true;
      errorMessage = 'You can upload only PNG or JPG files';
    }
    if (sizeNotAllowed || typeNotAllowed) {
      this.driveUploader.uploader.cancelAll();
      this.driveUploader.uploader.clearQueue();
      this.toastr.error(errorMessage);
    }
  }

  public toggleHint(): void {
    this.showHint = !this.showHint;
  }

  ngOnDestroy(): void {
    try {
      this.subscriptions$.unsubscribe();
    } catch {
    }

    this.editor.trigger('destroy');
    this.engine = null;
    this.data = null;
    if (this.editorObserver) {
      this.editorObserver.disconnect();
    }
  }
}
