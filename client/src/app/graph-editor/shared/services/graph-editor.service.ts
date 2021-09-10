import { GraphType, NodeStatus, NodeType } from '@aitheon/core-client';
import { Connection, Input, InteractionType, IO, Node, NodeEditor, Output } from '@aitheon/lib-graph';
import { FunctionalNode, InformationGraphNode, NodeVariables, SocketMetadata } from '@aitheon/system-graph';
import { Injectable } from '@angular/core';
import { ObjectID } from 'bson';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, take, map } from 'rxjs/operators';
import { GraphsService } from '../../../graphs/graphs.service';
import { IoType } from '../../../shared/enums/io-type.enum';
import { SocketPlacement } from '../../../shared/enums/socket-placement.enum';
import { ConnectionData } from '../../../shared/interfaces/connection-data.interface';
import { IoData } from '../../../shared/interfaces/io-data.interface';
import { NodeData, NodeModel } from '../../../shared/models/node.model';
import { get } from '../../../shared/utils/get';
import { SocketsService } from './sockets.service';

// tslint:disable:prefer-const

interface EditorData {
  id: string;
  nodes: {
    [key: string]: NodeModel;
  };
  view?: any;
}

@Injectable({
  providedIn: 'root',
})
export class GraphEditorService {
  private _editor$: BehaviorSubject<NodeEditor> = new BehaviorSubject<NodeEditor>(null);
  private _nodeAdded$: Subject<NodeModel> = new Subject<NodeModel>();
  private _updateEditor$ = new BehaviorSubject<EditorData>(null);
  private _makeIoVisible$ = new Subject<{
    node: string;
    io: Input | Output;
  }>();
  public onShowToolbox = new Subject<{
    contentType: 'MODELS' | 'NODES',
    nodeId: string | null,
  }>();
  public onHideToolbox = new Subject<void>();

  static processIo(node: any): { inputs: any, outputs: any } {
    let { lastRelease, inputs = [], outputs = [], nodeChannels = [] } = node;
    if (lastRelease) {
      const {
        inputs: releaseInputs = [],
        outputs: releaseOutputs = [],
        nodeChannels: releaseChannels = [],
      } = lastRelease;
      inputs = [...releaseInputs];
      outputs = [...releaseOutputs];
      nodeChannels = [...releaseChannels];
    }

    inputs.push(...nodeChannels.filter(({ type }) => type === 'server'));
    outputs.push(...nodeChannels.filter(({ type }) => type === 'client'));

    return { inputs, outputs };
  }

  getNodePosition(
    offset,
    client,
  ): number[] {
    const { container, transform } = this.editor.view.area;
    const rect = container.getBoundingClientRect() as any;
    const { x: containerX, y: containerY } = rect;
    const relativeX = client.clientX - containerX;
    const relativeY = client.clientY - containerY;
    const { x, y, k } = transform;
    return [(-x + relativeX - offset.offsetX) / k, (-y + relativeY - offset.offsetY) / k];
  }

  constructor(
    private graphsService: GraphsService,
    private socketsService: SocketsService,
  ) {}

  public get updateEditor$(): Observable<EditorData> {
    return this._updateEditor$.asObservable();
  }

  public get makeIoVisible$(): Observable<{ node: string, io: Input | Output }> {
    return this._makeIoVisible$.asObservable();
  }

  public get editor$(): Observable<NodeEditor> {
    return this._editor$.asObservable().pipe(filter(e => !!e));
  }

  public get nodeAdded$(): Observable<NodeModel> {
    return this._nodeAdded$.asObservable();
  }

  public set editor(editor: NodeEditor) {
    this._editor$.next(editor);
  }

  public get editor(): NodeEditor {
    return this._editor$.getValue();
  }

  addInformationNodes(nodes: InformationGraphNode[], isNew?: boolean): void {
    this.editor$.pipe(take(1)).subscribe(() => {
      nodes.filter(n => n.type === InformationGraphNode.TypeEnum.IMAGE).forEach(node => {
        const editorNode = this.createNode(node.type.toLowerCase(), node, node.position as any);
        this.addNode(editorNode);
      });

      if (isNew) {
        this.save();
      }
    });
  }

  public showToolbox(contentType: 'MODELS' | 'NODES', nodeId: string = null) {
    this.onShowToolbox.next({
      contentType,
      nodeId,
    });
  }

  public hideToolbox() {
    this.onHideToolbox.next();
  }

  public updateNodeInEditor(oldNodeId: string, updatedNode: any, editor, keepSettings?: boolean, isSubgraph?: boolean) {
    const editorData = editor.toJSON() as EditorData;
    const nodeToUpdate = editorData.nodes[oldNodeId] as NodeModel;
    nodeToUpdate.data = isSubgraph ? {
      ...nodeToUpdate.data,
      inputs: updatedNode.inputs,
      outputs: updatedNode.outputs,
    } : {
      ...nodeToUpdate.data,
      inference: keepSettings ? nodeToUpdate.data.inference : {},
      training: keepSettings ? nodeToUpdate.data.training : {},
      settings: keepSettings ? nodeToUpdate.data.settings : {
        ticks: updatedNode.ticks || [],
        parameters: (updatedNode?.settingParams || []).map(param => ({ ...param, value: param.default })),
      },
      templateName: updatedNode.name,
    } as NodeData;
    if (updatedNode.giteaReleaseId) {
      nodeToUpdate.data.graphNode.release = updatedNode;
    }
    if (!isSubgraph) {
      nodeToUpdate.data.inputs = this.getNodeIo(updatedNode, 'inputs');
      nodeToUpdate.data.outputs = this.getNodeIo(updatedNode, 'outputs');
    }

    const updatedInputs = {};
    const updatedOutputs = {};
    this.updateNodeIo(updatedInputs, 'input', editorData, nodeToUpdate, updatedNode, isSubgraph);
    this.updateNodeIo(updatedOutputs, 'output', editorData, nodeToUpdate, updatedNode, isSubgraph);

    nodeToUpdate.inputs = updatedInputs;
    nodeToUpdate.outputs = updatedOutputs;
    this._updateEditor$.next(editorData);
  }

  updateNodeIo(
    resultIo,
    type: 'input' | 'output',
    editorData,
    nodeToUpdate: NodeModel,
    newNode: FunctionalNode,
    isSubgraph: boolean,
  ): void {
    const multipleIoKey = `${type}s`;

    for (const io of isSubgraph ? newNode[multipleIoKey] : this.getNodeIo(newNode, multipleIoKey as any) as SocketMetadata[]) {
      const ioCentered = io.placement === SocketPlacement.CENTER;
      const matchedNodeIo = Object.entries(nodeToUpdate[multipleIoKey])
        .filter(([key]) => {
          const [name, id] = key.split('::');
          return id === io._id || name === io.name;
        });
      const ioConnections = this.getIoConnections(matchedNodeIo as any);
      const ioKey = `${io.name}::${io._id}`;

      if (ioCentered) {
        resultIo[`${ioKey}::LEFT`] = { connections: [] };
      }
      resultIo[`${io.name}::${io._id}${ioCentered ? `::RIGHT` : ''}`] = { connections: [] };

      // checking if updated node have the IO with same name.
      const oppositeIoKey = type === 'input' ? 'output' : 'input';
      ioConnections.forEach(connection => {
        const data: ConnectionData = connection.data;
        const ioData = type === 'input' ? data.target : data.source;
        const oppositeIoData = type === 'input' ? data.source : data.target;
        const oppositeIoName = `${oppositeIoData.name}::${oppositeIoData.metadataId}${oppositeIoData.entryPoint
          ? `::${oppositeIoData.entryPoint}`
          : ''}`;
        // finding source / target IO in editor data
        const connectedIo = editorData.nodes[connection.node][`${oppositeIoKey}s`][oppositeIoName];

        // checking if sockets are compatible
        if (ioData.socketId === io.socket as any && ioData.responseSocketId === io.responseSocket) {
          const defaultEntryPoint = type === 'input' ? SocketPlacement.LEFT : SocketPlacement.RIGHT;
          const ioEntryPoint = ioData.entryPoint || ioData.placement || defaultEntryPoint;
          const currentIoKey = ioCentered ? `${ioKey}::${ioEntryPoint}` : ioKey;
          const currentIo = get(resultIo, currentIoKey, { connections: [] });
          const newIoData = {
            ...ioData,
            entryPoint: ioCentered ? (ioData.entryPoint || defaultEntryPoint) : null,
            metadataId: io._id,
            name: io.name,
          } as IoData;
          const updatedConnectionData = {
            ...data,
            source: type === 'input' ? oppositeIoData : newIoData,
            target: type === 'input' ? newIoData : oppositeIoData,
          } as ConnectionData;
          resultIo[currentIoKey] = {
            connections: [
              ...currentIo.connections,
              {
                node: oppositeIoData.nodeId,
                [oppositeIoKey]: oppositeIoName,
                data: updatedConnectionData,
              },
            ],
          };

          for (const oppositeConnection of connectedIo.connections) {
            if (oppositeConnection.node === nodeToUpdate.id) {
              if (oppositeConnection[type].includes(io._id) || oppositeConnection[type].includes(io.name)) {
                if (oppositeConnection.data[type === 'input' ? 'source' : 'target'].metadataId === oppositeIoData.metadataId) {
                  oppositeConnection[type] = currentIoKey;
                  oppositeConnection.data = updatedConnectionData;
                }
              }
            }
          }
        } else {
          // deleting source/target connection
          connectedIo.connections = connectedIo.connections
            // tslint:disable-next-line:no-shadowed-variable
            .filter(oppositeConnection => {
              return oppositeConnection.data[type === 'input' ? 'source' : 'target'].metadataId !== oppositeIoData.metadataId;
            });
        }
      });
    }
  }

  getNodeIo(release: any, ioKey: 'inputs' | 'outputs'): SocketMetadata[] {
    let { [ioKey]: io, nodeChannels = [] } = release;
    io = [...io];
    io.push(...nodeChannels.filter(({ type }) => type === (ioKey === 'inputs' ? 'server' : 'client')));

    return io;
  }

  getGraphNodes(): Observable<NodeModel[]> {
    return this.editor$.pipe(map(e => e?.nodes as any || []));
  }

  getIoConnections(io: [string, IO][]) {
    return io.reduce((result, current) => {
      return [
        ...result,
        ...current[1].connections
      ];
    }, []);
  }

  prepareNode(
    node: any,
    offset: { offsetX: number, offsetY: number },
    clientCoordinates: { clientX: number, clientY: number },
  ): NodeModel {
    const {
      templateVariables = {},
      name = '',
      lastRelease,
    } = node;
    const { inputs, outputs } = GraphEditorService.processIo(node);
    const position = this.getNodePosition(offset, clientCoordinates);
    const { settings, training, inference } = templateVariables as NodeVariables;

    switch (node.type as NodeType | GraphType) {
      case NodeType.TEXTAREA:
      case NodeType.IMAGE:
        return {
          id: new ObjectID().toString(),
          data: {
            _id: new ObjectID().toString(),
            ...node as any,
          },
          position,
          inputs: {},
          outputs: {},
          name: 'node',
        };
      case GraphType.SUBGRAPH:
        return {
          id: new ObjectID().toString(),
          data: node,
          position,
          inputs: {},
          outputs: {},
          name: 'node',
        };

      default:
        return {
          id: new ObjectID().toString(),
          data: node.type === GraphType.TEMPLATE ? {
            ...node,
            name: this.generateNodeName(name),
            inputs,
            outputs,
            enabled: true,
            type: GraphType.LINKED,
            status: NodeStatus.CREATED,
          } : {
            type: null,
            ...node,
            name: this.generateNodeName(name),
            enabled: true,
            project: node.project,
            training: {
              enabled: false,
              interval: 0,
              consensusConfirmations: 0,
              permissions: {
                owner: false,
                admin: false,
                user: false,
                specialist: false,
              },
              ...training,
            },
            inference: {
              enabled: false,
              modelId: null,
              ...inference,
            },
            inputs,
            outputs,
            settings: {
              mapping: {
                enabled: false,
                propertyMaps: []
              },
              ...settings,
              ticks: lastRelease?.ticks,
              parameters: lastRelease?.settingParams.map(param => ({ ...param, value: param.default })),
            },

            // REWORKED PART
            graphNode: {
              release: lastRelease,
            },
            isLatest: true,
          } as NodeData,
          position,
          name: 'node',
          inputs: this.getConnections(inputs),
          outputs: this.getConnections(outputs),
        };
    }
  }

  getConnections(sockets: SocketMetadata[]) {
    const connections = {};
    for (const { name, _id } of sockets) {
      connections[`${name}::${_id}`] = {
        connections: [],
      };
    }
    return connections;
  }

  generateNodeName(nodeName: string) {
    let index = 0;
    let resultName = nodeName;
    const nodeNames = Object.values(this.editor.nodes)
      .map(node => node.data.name as string)
      .filter(name => name?.includes(nodeName));
    while (nodeNames.includes(resultName)) {
      resultName = `${nodeName} ${++index}`;
    }
    return resultName;
  }

  addNodeToEditor(node: FunctionalNode, offset, dropCoordinates) {
    if (node.type === GraphType.TEMPLATE) {
      this.graphsService.reloadOnSave = true;
    }

    const preparedNode = this.prepareNode(node, offset, dropCoordinates);
    const editorData = this.editor.toJSON();
    const data = {
      ...editorData,
      nodes: {
        ...editorData.nodes,
        [node._id]: preparedNode,
      }
    } as EditorData;
    this._updateEditor$.next(data);
    this._nodeAdded$.next(preparedNode);
  }

  public updateEditorData(data: any): void {
    this._updateEditor$.next(data);
  }

  getNodeById(id: string): Node {
    return this.editor.nodes.find(node => (node.id as any) === id);
  }

  public getAveragedPositionOfNodes(firstNodeId: string, secondNodeId: string, nodeWidth = 400): [number, number] {
    const firstNode = this.getNodeById(firstNodeId);
    const secondNode = this.getNodeById(secondNodeId);
    if (firstNode && secondNode) {
      return [
        (firstNode.position[0] + nodeWidth + secondNode.position[0]) / 2,
        (firstNode.position[1] + secondNode.position[1]) / 2,
      ];
    }
  }

  // TODO update to handle all node types
  public createNode(nodeName: string, nodeData: any, position: [number, number], id?: string): Node {
    const node = new Node(nodeName);
    node.position = position;
    node.data = nodeData;
    node.id = id || nodeData._id;
    if (['mapping'].includes(nodeName)) {
      this.addIoToNode(node, nodeData.input, IoType.INPUT);
      this.addIoToNode(node, nodeData.output, IoType.OUTPUT);
    }
    return node;
  }

  // TODO update to handle all cases
  public addIoToNode(node: Node, io: SocketMetadata, ioType: IoType): Input | Output {
    const graphIo = ioType === IoType.INPUT ? Input : Output;
    const newIo = new graphIo(`${io.name}::${io._id}`, io.name, {
      multiConns: ioType === IoType.OUTPUT,
      placement: null,
      socket: this.socketsService.getSocket(io.socket as any),
      type: InteractionType.EVENT,
    }) as any;
    if (ioType === IoType.INPUT) {
      node.addInput(newIo);
    } else {
      node.addOutput(newIo);
    }
    node.update();
    return newIo;
  }

  public addNode(node: Node): void {
    if (this.editor) {
      this.editor.addNode(node);
    }
  }

  public connect(outputNodeData: { node: string, output: SocketMetadata }, inputNodeData: { node: string, input: SocketMetadata }): void {
    const outputNode = this.getNodeById(outputNodeData.node);
    const output = outputNode.outputs.get(this.getIoKey(outputNodeData.output));
    this._makeIoVisible$.next({ node: outputNodeData.node, io: output });
    const inputNode = this.getNodeById(inputNodeData.node);
    const input = inputNode.inputs.get(this.getIoKey(inputNodeData.input));

    if (!input.multipleConnections && input.hasConnection()) {
      this.editor.removeConnection(input.connections[0]);
    }

    this._makeIoVisible$.next({ node: inputNodeData.node, io: input });
    this.editor.connect(output, input);
  }

  public getIoKey(io: SocketMetadata): string {
    return `${io.name}::${io._id}`;
  }

  public removeConnection(connection: Connection): void {
    this.editor?.removeConnection(connection);
  }

  public clearNodeConnections(node: Node, ioType?: IoType) {
    if (ioType) {
      node[`${ioType.toLowerCase()}s`].forEach(io => this.removeIoConnections(io));
    } else {
      node.inputs.forEach(input => this.removeIoConnections(input));
      node.outputs.forEach(output => this.removeIoConnections(output));
    }
  }

  public removeNodeIo(node: Node, ioType: IoType): void {
    const ioArray = [];
    if (ioType === IoType.INPUT) {
      node.inputs.forEach(i => {
        ioArray.push(i);
      });
    } else {
      node.outputs.forEach(o => {
        ioArray.push(o);
      });
    }
    for (const io of ioArray) {
      if (io instanceof Input) {
        node.removeInput(io);
      } else {
        node.removeOutput(io);
      }
    }
  }

  public removeIoConnections(io: IO): void {
    io.connections.slice().forEach(this.editor.removeConnection.bind(this.editor));
  }

  public save(): void {
    this.editor.trigger('save');
  }

  public get statusesColors() {
    return {
      default: '#dcbc65',
      disabled: '#454545',
    };
  }
}
