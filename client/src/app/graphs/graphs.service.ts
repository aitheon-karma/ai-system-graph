import { GraphType, NodeType } from '@aitheon/core-client';
import { IO } from '@aitheon/lib-graph';
import {
  FunctionalGraphNode,
  Graph,
  GraphConnection,
  GraphNode,
  GraphsRestService,
  InformationGraphNode,
  MappingNode,
  NodesRestService,
  ServiceGraph,
  ServiceGraphNode,
  SocketJunctionPoint,
  SocketMetadata,
  SubgraphGraphNode,
} from '@aitheon/system-graph';
import { Injectable, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ObjectID } from 'bson';

import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { SocketsService } from '../graph-editor/shared/services/sockets.service';
import { getIoMetadataFromKey } from '../graph-editor/shared/utils/get-io-metadata-from-key';
import { ConnectionType } from '../shared/enums/connection-type.enum';
import { SocketPlacement } from '../shared/enums/socket-placement.enum';
import { ConnectionData } from '../shared/interfaces/connection-data.interface';
import { IoData } from '../shared/interfaces/io-data.interface';
import { NodeData, NodeModel } from '../shared/models/node.model';
import { get } from '../shared/utils/get';

@Injectable({
  providedIn: 'root',
})
export class GraphsService {

  public static get editorId() {
    return 'ai-system-graph@0.3.0';
  }

  constructor(
    private socketsService: SocketsService,
    private nodesRestService: NodesRestService,
    private graphsRestService: GraphsRestService,
    private toastrService: ToastrService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
  ) {
    this.triggerSave = this.triggerSave.bind(this);
  }

  public get graphChanged$(): Observable<Graph | ServiceGraph> {
    return this._graphChanged$.asObservable();
  }

  public set reloadOnSave(value: boolean) {
    this.reloadWhenSaved = value;
  }

  public get reloadOnSave(): boolean {
    return this.reloadWhenSaved;
  }

  public get graphType(): string {
    return this.graph ? this.graph.type : null;
  }

  public get subGraphTemplate(): Graph {
    // @ts-ignore
    return {
      _id: new ObjectID().toString(),
      outputs: [],
      inputs: [],
      type: GraphType.TEMPLATE,
      graphNodes: [],
      subgraphNodes: [],
    } as Graph;
  }
  private _graphChanged$ = new BehaviorSubject<Graph | ServiceGraph>(null);

  public onSubGraphCreate = new Subject<any>();
  public onShowGraphBuild = new Subject<Graph | null>();
  public graphTemplateFormChanged = new Subject<{ name: string, runtime: string }>();
  public saveTriggered = new Subject<void>();
  public triggerReload = new Subject<void>();
  public duplicatedNodes = new Subject<any>();
  public duplicatedNodesCollection: any;
  public runningGraphsIds: string[] = [];
  public organization: any;
  private graph: Graph | ServiceGraph;
  private nodePositions: {
    initX: number,
    initY: number,
    currentX: number,
    currentY: number,
    currentIndex: number,
  } = {
    initX: 0,
    initY: 0,
    currentX: 0,
    currentY: 0,
    currentIndex: 0,
  };
  reloadWhenSaved = false;

  private static validatePosition(position: [number, number]): void {
    const replaceNumber = (array: any, index: number, oldValue: any, newValue: any) => {
      if (array[index] === oldValue) {
        array[index] = newValue;
      }
    };
    replaceNumber(position, 0, 0, 1);
    replaceNumber(position, 1, 0, 1);
  }

  private static calculateNodeY(node: any): number {
    const ioHeight = 48;
    const headerHeight = 60;
    const mapIoHeight = 112;
    const nodeIo = GraphsService.getIoFromGraphNode(node);
    const centeredIoCount = nodeIo.reduce((r, c) => c.placement === SocketPlacement.CENTER ? ++r : r, 0);
    const sumIoCount = (nodeIo.length - centeredIoCount) / 2 + centeredIoCount;

    return Math.round(node.position[1] + headerHeight + mapIoHeight + (sumIoCount * ioHeight));
  }

  private static getIoFromGraphNode(graphNode: any): SocketMetadata[] {
    let io;
    if (graphNode.input && graphNode.input) {
      io = [graphNode.input, graphNode.output];
    } else {
      const node = graphNode.graph || graphNode.node;
      if (node) {
        io = [...(node.inputs || []), ...(node.outputs || [])];
      }
    }
    return io || [];
  }

  private static getIo(sockets: SocketMetadata[]) {
    const io = {};
    if (sockets) {
      for (const { name, _id, placement } of sockets) {
        if (placement === SocketPlacement.CENTER) {
          io[`${name}::${_id}::LEFT`] = {
            connections: [],
          };
        }
        io[`${name}::${_id}${placement === SocketPlacement.CENTER ? '::RIGHT' : ''}`] = {
          connections: [],
        };
      }
    }
    return io;
  }

  private static getValidIo(io: SocketMetadata[] = [], isGraphCore: boolean = false) {
    return io.filter(({ core }) => {
      if (isGraphCore) {
        return true;
      }
      return !core;
    });
  }

  private static getNodesArea(xCoordinates: number[], yCoordinates: number[]): {
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
  } {
    if (!xCoordinates.length || !yCoordinates.length) {
      return {
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0,
      };
    }
    return {
      xMin: Math.min(...xCoordinates),
      xMax: Math.max(...xCoordinates),
      yMin: Math.min(...yCoordinates),
      yMax: Math.max(...yCoordinates),
    };
  }

  private static isPositionInvalid(position) {
    return !position || !position.length || position.includes(null) || position.includes(undefined) || position.every(c => c === 0);
  }

  private static parseConnections(connections: any[], nodes): any[] {
    return connections.reduce((result, { input, nodeId, nodeType }) => {
      if (!input.connections.length) {
        return result;
      }
      const ioConnections: GraphConnection[] = [];
      for (const connection of input.connections) {
        const { node, data } = connection;
        const outputNode = Object.values(nodes)
          .find(({ id }) => id === node) as NodeModel;
        if (!outputNode.data.subGraphIoType) {
          const { source, target, type } = data as ConnectionData;
          const isOutputSubgraph = outputNode.data.type === NodeType.LINKED ||
            outputNode.data.type === GraphType.SERVICE ||
            outputNode.data.type === GraphType.SUBGRAPH;
          const isOutputMapping = !!(outputNode.data as unknown as MappingNode).mapping;
          ioConnections.push({
            type,
            source: {
              entryPoint: source.entryPoint,
              graphNodeId: outputNode.id,
              socketMetadataId: source.metadataId,
              type: isOutputSubgraph ? ConnectionType.SUBGRAPH : (isOutputMapping ? ConnectionType.MAPPING : ConnectionType.NODE),
            } as SocketJunctionPoint,
            target: {
              entryPoint: target.entryPoint,
              graphNodeId: nodeId,
              socketMetadataId: target.metadataId,
              type: (
                nodeType === NodeType.LINKED ||
                nodeType === GraphType.SERVICE ||
                nodeType === GraphType.SUBGRAPH
              ) ? ConnectionType.SUBGRAPH : (nodeType === 'MAPPING' ? ConnectionType.MAPPING : ConnectionType.NODE),
            } as SocketJunctionPoint,
            pins: connection.data.pins,
          } as GraphConnection);
        }
      }
      return [
        ...result,
        ...ioConnections,
      ];
    }, []);
  }

  private parseNodes(nodes: { [key: string]: NodeModel }, connections: any[]): any[] {
    return Object.values(nodes)
      .filter((node: NodeModel) => !node.data.subGraphIoType)
      .map(node => {
        const isMappingNode = node.name === 'mapping';
        const { data, position, id, inputs } = node as any;
        GraphsService.validatePosition(position);
        const {
          sockets,
          training,
          settings = {},
          inference,
          device,
          _id: nodeId,
          status,
          graphNode,
          isServiceSpecific,
          project,
          ...nodeData
        } = data;
        connections.push(...(Object.values(inputs)
          .map(input => ({ input, nodeId: id, nodeType: isMappingNode ? 'MAPPING' : data.type })) as any));

        if (isMappingNode) {
          return { ...data, position } as unknown as MappingNode;
        }

        switch (nodeData.type as NodeType | GraphType) {
          case NodeType.LINKED:
          case GraphType.SERVICE:
          case GraphType.TEMPLATE:
          case GraphType.SUBGRAPH:
            return {
              status,
              graphNodeName: nodeData.name,
              _id: id,
              type: nodeData.type,
              graph: nodeId,
              ioSettings: graphNode?.ioSettings,
              position,
            };
          case NodeType.IMAGE:
          case NodeType.TEXTAREA:
          case NodeType.CORE_NODE:
            return {
              ...nodeData,
              _id: nodeId,
              position,
            };
          default:
            const parsedNode = {
              type: nodeData.type,
              graphNodeName: nodeData.name,
              _id: id,
              node: nodeId,
              status,
              instanceVariables: {
                training,
                settings: {
                  ...settings,
                  parameters: settings.parameters || [],
                },
                inference,
              },
              position,
            } as FunctionalGraphNode;
            if (device) {
              (parsedNode as any).device = device?._id || device;
            }
            if (graphNode && graphNode.release) {
              parsedNode.release = graphNode.release;
            }
            if (data.type === NodeType.SERVICE_NODE && this.graph?.subType === Graph.SubTypeEnum.SPECIAL) {
              parsedNode.isServiceSpecific = isServiceSpecific;
              (parsedNode as any).project = project;
            }
            parsedNode.ioSettings = graphNode?.ioSettings || [];
            return parsedNode;
        }
      });
  }

  private splitNodesByType(parsedNodes: any[]): {
    graphNodes: GraphNode[],
    subgraphNodes: SubgraphGraphNode[],
    informationNodes: InformationGraphNode[],
    serviceGraphNode: ServiceGraphNode,
    mappingNodes: MappingNode[],
  } {
    const subgraphNodes = [];
    const graphNodes = [];
    const informationNodes = [];
    const mappingNodes = [];
    let serviceGraphNode = null;
    for (const nodeObject of parsedNodes) {
      if (!!nodeObject.mapping) {
        mappingNodes.push(nodeObject);
      } else {
        switch (nodeObject.type as NodeType | GraphType) {
          case NodeType.LINKED:
          case GraphType.SUBGRAPH:
          case GraphType.SERVICE:
            subgraphNodes.push(nodeObject);
            break;
          case NodeType.SERVICE_NODE:
            if (this.graph.type === GraphType.SERVICE) {
              const { instanceVariables, ...restNode } = nodeObject;
              serviceGraphNode = restNode;
            } else {
              graphNodes.push(nodeObject);
            }
            break;
          case NodeType.IMAGE:
          case NodeType.TEXTAREA:
            informationNodes.push(nodeObject);
            break;
          default:
            graphNodes.push(nodeObject);
        }
      }
    }
    return { graphNodes, subgraphNodes, informationNodes, serviceGraphNode, mappingNodes };
  }

  public createGraph(graph: Graph, isChild: boolean) {
    if (isChild) {
      return this.graphsRestService.create({
        ...graph,
        parent: this.graph._id,
      });
    }
    return this.graphsRestService.create(graph);
  }

  public updateGraph(graph: Graph) {
    const { _id } = graph;
    return this.graphsRestService.update(_id, graph);
  }

  public removeGraph(id: string) {
    return this.graphsRestService.remove({
      data: [id],
    });
  }

  public deployNode(graphNodeId: string, deploy: boolean, updateToLatest = false): Observable<any> {
    return this.graphsRestService.deployNode({
      publish: deploy,
      graphNodeId,
      updateToLatestRelease: updateToLatest,
    }).pipe(catchError(e => {
        this.ngZone.run(() => {
          this.toastrService.error(e.message || `Unable to ${deploy ? 'deploy' : 'stop'} node!`);
        });
        return of(null);
      }),
      tap(() => {
        this.ngZone.run(() => {
          this.toastrService.success(`Node successfully ${deploy ? 'deployed' : 'stopped'}`);
        });
      }));
  }

  public deploySubgraph(subgraphId: string, deploy: boolean): Observable<void> {
    const request$ = deploy ? this.graphsRestService.deploySubGraph(subgraphId) : this.graphsRestService.stopSubGraph(subgraphId);
    return request$.pipe(catchError(e => {
        this.ngZone.run(() => {
          this.toastrService.error(e.message || `Unable to ${deploy ? 'deploy' : 'stop'} subgraph!`);
        });
        return of(null);
      }),
      tap(() => {
        this.ngZone.run(() => {
          this.toastrService.success(`Subgraph successfully ${deploy ? 'deployed' : 'stopped'}`);
        });
      }));
  }

  public triggerSave() {
    this.saveTriggered.next();
  }

  public parseSubGraphEditorData(editorData: { nodes: any, id: string }) {
    let inputConnections = [];
    let outputConnections = [];
    let outputs = [];
    let inputs = [];
    const graphChannels = [];
    for (const node of Object.values(editorData.nodes) as NodeModel[]) {
      if (node.data.subGraphIoType === 'input') {
        inputs = get(node, 'data.outputs', []).filter(input => {
          if (input.type && input.responseSocket) {
            graphChannels.push(input);
            return false;
          }
          return true;
        });
        inputConnections = Object.values(node.outputs || {});
      }
      if (node.data.subGraphIoType === 'output') {
        outputs = get(node, 'data.inputs', []).filter(output => {
          if (output.type && output.responseSocket) {
            graphChannels.push(output);
            return false;
          }
          return true;
        });
        outputConnections = Object.values(node.inputs || {});
      }
    }

    const subGraphInterfaceConnections = this.getSubGraphNodeConnections(
      inputConnections,
      outputConnections,
      {
        inputs,
        outputs,
        graphChannels,
        name: this.graph.name,
        id: this.graph._id,
      },
      Object.values(editorData.nodes),
    );

    const parsedData = this.parseEditorData(editorData, true, subGraphInterfaceConnections);
    if (!parsedData) {
      return null;
    }

    return {
      ...parsedData,
      inputs,
      outputs,
      nodeChannels: graphChannels,
    };
  }

  private getSubGraphNodeConnections(inputs: any[], outputs: any[], graphInterface: any, nodes: any) {
    const subGraphIoConnections: GraphConnection[] = [];
    const subgraphTypes = [NodeType.LINKED, GraphType.SUBGRAPH, GraphType.SERVICE];
    for (const input of inputs) {
      for (const connection of input.connections) {
        const targetNode = nodes.find((node: NodeModel) => node.id === connection.node) as NodeModel;
        const sourceSocket = graphInterface.inputs.find(socket => socket._id === connection.data.source.metadataId)
          || graphInterface.graphChannels.find(socket => socket._id === connection.data.source.metadataId);
        const isTargetSubgraph = subgraphTypes.includes(targetNode.data.type as any);
        subGraphIoConnections.push({
          type: connection.data.type,
          source: {
            graphNodeId: graphInterface.id,
            socketMetadataId: sourceSocket._id,
            type: ConnectionType.INTERFACE,
          } as SocketJunctionPoint,
          target: {
            graphNodeId: targetNode.id,
            socketMetadataId: connection.data.target.metadataId,
            type: isTargetSubgraph ? ConnectionType.SUBGRAPH : ConnectionType.NODE,
            entryPoint: connection.data.target.entryPoint,
          } as SocketJunctionPoint,
          pins: connection.data.pins,
        } as GraphConnection);
      }
    }
    for (const output of outputs) {
      for (const connection of output.connections) {
        const sourceNode = nodes.find((node: NodeModel) => node.id === connection.node) as NodeModel;
        const isSourceSubgraph = subgraphTypes.includes(sourceNode.data.type as any);
        const targetSocket = graphInterface.outputs.find(socket => socket._id === connection.data.target.metadataId)
          || graphInterface.graphChannels.find(socket => socket._id === connection.data.target.metadataId);
        subGraphIoConnections.push({
          type: connection.data.type,
          source: {
            graphNodeId: sourceNode.id,
            socketMetadataId: connection.data.source.metadataId,
            type: isSourceSubgraph ? ConnectionType.SUBGRAPH : ConnectionType.NODE,
            entryPoint: connection.data.source.entryPoint,
          } as SocketJunctionPoint,
          target: {
            graphNodeId: graphInterface.id,
            socketMetadataId: targetSocket._id,
            type: ConnectionType.INTERFACE,
          } as SocketJunctionPoint,
          pins: connection.data.pins,
        } as GraphConnection);
      }
    }
    return subGraphIoConnections;
  }

  public parseEditorData(
    editorData: { nodes: any, id: string },
    isSubGraph?: boolean,
    subGraphIoConnections?: any[],
  ): {
    connections: GraphConnection[],
    graphNodes: GraphNode[],
    subgraphNodes: SubgraphGraphNode[],
    informationNodes: InformationGraphNode[],
    serviceGraphNode?: ServiceGraphNode,
    mappingNodes?: MappingNode[],
  } {
    const { nodes } = editorData;
    const connections = [];
    const parsedNodes = this.parseNodes(nodes, connections);
    const parsedConnections = GraphsService.parseConnections(connections, nodes);

    const unique = this.isNodesNamesUnique(parsedNodes);
    if (unique) {
      const { graphNodes, subgraphNodes, informationNodes, serviceGraphNode, mappingNodes } = this.splitNodesByType(parsedNodes);

      return {
        connections: isSubGraph ? [...parsedConnections, ...subGraphIoConnections] : parsedConnections,
        graphNodes: this.clearGraphNodes(graphNodes),
        subgraphNodes: this.clearGraphNodes(subgraphNodes),
        informationNodes,
        mappingNodes,
        serviceGraphNode,
      };
    }

    this.toastrService.error('Nodes names not unique!');
    return null;
  }

  clearGraphNodes(nodes: any[]) {
    return nodes.map(node => {
      const { type, ...restNode } = node as any;
      return restNode;
    });
  }

  mapSubGraphNodeIo(io: any[] = [], isInput: boolean = false, channels: any[] = []) {
    return [...io.map(item => ({ ...item, multiple: isInput })), ...channels];
  }

  public createEditorDataFromGraph(graph: any) {
    const editorNodesObject = {};
    const isSubGraph = graph.type === GraphType.LINKED ||
      graph.type === GraphType.SUBGRAPH ||
      graph.type === GraphType.TEMPLATE;
    const isServiceGraph = graph.type === GraphType.SERVICE;
    const { graphNodes, subgraphNodes, serviceGraphNode, connections, informationNodes = [], mappingNodes = [] } = graph as any;
    const allNodes = [...graphNodes, ...informationNodes.filter(n => n.type !== NodeType.IMAGE), ...subgraphNodes, ...mappingNodes];
    if (serviceGraphNode) {
      allNodes.push(serviceGraphNode);
    }

    const { nodesX, nodesY, positionsStatus } = this.getNodesPositions(allNodes);
    const nodesArea = GraphsService.getNodesArea(nodesX, nodesY);
    const initY = positionsStatus === 'PARTIAL' ? nodesArea.yMax + 300 : 0;
    this.nodePositions = {
      ...this.nodePositions,
      initX: nodesArea.xMin,
      currentX: nodesArea.xMin,
      initY,
      currentY: initY,
    };

    const preparedNodes = this.prepareNodes(allNodes, graph.core);
    if (isSubGraph || isServiceGraph) {
      this.createInterfaceNodes(editorNodesObject, preparedNodes, graph, nodesArea);
    }

    const editorNodes = preparedNodes.map(node => {
      const isMappingNode = node.name === 'mapping';
      if (node.data.subGraphIoType) {
        return node;
      }
      if (node.data.type === NodeType.TEXTAREA || node.data.type === NodeType.IMAGE) {
        return {
          ...node,
          inputs: {},
          outputs: {},
        };
      }

      const { data, id } = node;
      const { inputs, outputs } = data;

      const nodeConnections = connections
        .filter(({ source, target }) => (<any>source).graphNodeId === id || (<any>target).graphNodeId === id);
      const graphNodeOutputs = GraphsService.getIo(isMappingNode ? [data.output] : outputs);
      const graphNodeInputs = GraphsService.getIo(isMappingNode ? [data.input] : inputs);
      for (const { source, target, pins, type } of nodeConnections) {
        if (source.graphNodeId === id) {
          try {
            const targetNode = preparedNodes.find(nodeObject => {
              if (nodeObject.data.subGraphIoType === 'output') {
                return true;
              }
              return nodeObject.id === target.graphNodeId;
            });
            const targetNodeInput = targetNode.name === 'mapping'
              ? targetNode.data.input
              : targetNode.data.inputs.find(({ _id }) => _id === target.socketMetadataId);
            const output = isMappingNode ? node.data.output : outputs.find(({ _id }) => _id === source.socketMetadataId);
            const outputName = `${output.name}::${output._id}${source.entryPoint ? `::${source.entryPoint}` : ''}`;
            const nodeOutput = graphNodeOutputs[outputName];
            graphNodeOutputs[outputName] = {
              ...nodeOutput,
              connections: [
                ...nodeOutput.connections,
                {
                  node: targetNode.id,
                  input: `${targetNodeInput.name}::${targetNodeInput._id}${target.entryPoint ? `::${target.entryPoint}` : ''}`,
                  data: {
                    type,
                    source: {
                      nodeId: node.id,
                      name: output.name,
                      metadataId: output._id,
                      socketId: output.socket,
                      responseSocketId: output.responseSocket,
                      entryPoint: source.entryPoint,
                    } as IoData,
                    target: {
                      nodeId: targetNode.id,
                      name: targetNodeInput.name,
                      metadataId: targetNodeInput._id,
                      socketId: targetNodeInput.socket,
                      entryPoint: target.entryPoint,
                      responseSocketId: target.responseSocket,
                    } as IoData,
                    pins,
                  } as unknown as ConnectionData,
                },
              ],
            };
          } catch (e) {
          }
        }
        if (target.graphNodeId === id) {
          try {
            const sourceNode = preparedNodes.find(nodeObject => {
              if (nodeObject.data.subGraphIoType === 'input') {
                return true;
              }
              return nodeObject.id === source.graphNodeId;
            });
            const sourceNodeOutput = sourceNode.name === 'mapping'
              ? sourceNode.data.output
              : sourceNode.data.outputs.find(({ _id }) => _id === source.socketMetadataId);
            const input = isMappingNode ? node.data.input : inputs.find(({ _id }) => _id === target.socketMetadataId);
            const inputName = `${input.name}::${input._id}${target.entryPoint ? `::${target.entryPoint}` : ''}`;
            const nodeInput = graphNodeInputs[inputName];
            graphNodeInputs[inputName] = {
              ...nodeInput,
              connections: [
                ...nodeInput.connections,
                {
                  node: sourceNode.id,
                  output: `${sourceNodeOutput.name}::${sourceNodeOutput._id}${source.entryPoint ? `::${source.entryPoint}` : ''}`,
                  data: {
                    type,
                    source: {
                      nodeId: sourceNode.id,
                      name: sourceNodeOutput.name,
                      socketId: sourceNodeOutput.socket,
                      responseSocketId: sourceNodeOutput.responseSocket,
                      metadataId: sourceNodeOutput._id,
                      entryPoint: source.entryPoint,
                    } as IoData,
                    target: {
                      nodeId: node.id,
                      name: input.name,
                      metadataId: input._id,
                      responseSocketId: input.responseSocket,
                      socketId: input.socket,
                      entryPoint: target.entryPoint,
                    } as IoData,
                    pins,
                  } as unknown as ConnectionData,
                },
              ],
            };
          } catch (e) {
          }
        }
      }
      return {
        ...node,
        outputs: graphNodeOutputs,
        inputs: graphNodeInputs,
      };
    });
    for (const node of editorNodes) {
      editorNodesObject[node.id] = node;
    }
    return { id: GraphsService.editorId, nodes: editorNodesObject };
  }

  prepareNodes(nodes: any[], isCoreGraph: boolean) {
    return nodes.map((graphNode) => {
      const {
        position,
        _id,
        graphNodeName,
        instanceVariables,
        graph: nodeGraph,
        node,
        isLatest,
        status = 'SAVED',
        statuses,
        release,
        ioSettings,
        device,
        isServiceSpecific,
        project,
      } = graphNode;
      const staticNodeData = {
        id: _id,
        position: GraphsService.isPositionInvalid(position) ? this.getNodePosition() : position,
        name: graphNode.mapping ? 'mapping' : 'node',
      };
      if (graphNode.mapping) {
        return {
          ...staticNodeData,
          data: graphNode,
        };
      }
      if (nodeGraph) {
        // tslint:disable-next-line:no-shadowed-variable prefer-const
        let { inputs, outputs, nodeChannels = [] } = nodeGraph;
        inputs = [...inputs];
        inputs.push(...nodeChannels.filter(({ type }) => type === 'server'));
        outputs = [...outputs];
        outputs.push(...nodeChannels.filter(({ type }) => type === 'client'));
        return {
          ...staticNodeData,
          data: {
            isLatest,
            status,
            ...nodeGraph,
            inputs: GraphsService.getValidIo(inputs, isCoreGraph),
            outputs: GraphsService.getValidIo(outputs, isCoreGraph),
            name: graphNodeName,
            graphNode: {
              ioSettings,
            },
            statuses
          },
        };
      }
      if (graphNode.type === NodeType.TEXTAREA || graphNode.type === NodeType.IMAGE) {
        return {
          ...staticNodeData,
          data: graphNode,
        };
      }

      // tslint:disable-next-line:prefer-const
      let { inputs = [], outputs = [], nodeChannels = [] } = release ? release : node;
      inputs = [...inputs];
      inputs.push(...nodeChannels.filter(({ type }) => type === 'server'));
      outputs = [...outputs];
      outputs.push(...nodeChannels.filter(({ type }) => type === 'client'));

      const editorNode = {
        ...staticNodeData,
        data: {
          ...node,
          inputs: GraphsService.getValidIo(inputs, isCoreGraph),
          outputs: GraphsService.getValidIo(outputs, isCoreGraph),
          ...instanceVariables,
          status,
          name: graphNodeName,
          templateName: node && node.name,
          _id: node && node._id,
          isLatest,
          device,
          graphNode: {
            ioSettings,
          },
        } as NodeData,
      } as NodeModel;
      if (release) {
        editorNode.data.graphNode.release = release;
      }
      if (node.type === NodeType.SERVICE_NODE && this.graph?.subType === Graph.SubTypeEnum.SPECIAL) {
        (editorNode as any).data.isServiceSpecific = isServiceSpecific;
        (editorNode as any).data.project = project;
      }
      return editorNode;
    });
  }

  createInterfaceNodes(editorNodesObject, preparedNodes: any[], graph: Graph, nodesArea: any) {
    const inputInterfaceNode = this.createInterfaceNode('input', graph, preparedNodes, nodesArea);
    const outputInterfaceNode = this.createInterfaceNode('output', graph, preparedNodes, nodesArea);
    preparedNodes.push(inputInterfaceNode, outputInterfaceNode);

    editorNodesObject[inputInterfaceNode.id] = inputInterfaceNode;
    editorNodesObject[outputInterfaceNode.id] = outputInterfaceNode;
  }

  createInterfaceNode(interfaceType: 'input' | 'output', graph: Graph, nodes: any, nodesArea: any) {
    const isInput = interfaceType === 'input';
    const ioKey = isInput ? 'outputs' : 'inputs';
    const channels = (graph.nodeChannels || []).filter(({ type }) => type === (isInput ? 'server' : 'client'));
    const io = this.mapSubGraphNodeIo(graph[`${interfaceType}s`], isInput, channels);
    return {
      id: new ObjectID().toString(),
      data: {
        type: graph.type,
        status: graph.status,
        name: graph.name,
        subGraphIoType: interfaceType,
        [ioKey]: io,
        disabled: false,
      } as any,
      [ioKey]: this.getSubGraphIo(io, graph.connections, nodes, isInput ? 'output' : 'input'),
      [`${interfaceType}s`]: {},
      name: 'node',
      meta: {
        ignorePosition: true,
      },
      position: [nodesArea.xMin, nodesArea.yMin],
    };
  }

  getSubGraphIo(sockets, connections: GraphConnection[], nodes, type: 'input' | 'output') {
    const io = GraphsService.getIo(sockets);
    const isOutput = type === 'output';
    for (const socket of sockets) {
      const ioKey = `${socket.name}::${socket._id}`;
      const ioConnections = connections.filter(connection => {
        if (isOutput) {
          return connection.source.socketMetadataId === socket._id;
        }
        return connection.target.socketMetadataId === socket._id;
      });
      const editorIoKey = isOutput ? 'input' : 'output';
      io[ioKey] = {
        connections: ioConnections.map(connection => {
          try {
            const connectedNode = nodes.find(node => {
              if (isOutput) {
                return node.id === connection.target.graphNodeId;
              }
              return node.id === connection.source.graphNodeId;
            });
            if (!connectedNode) {
              return {};
            }
            const connectedNodeSocket = [
              ...connectedNode.data.inputs,
              ...connectedNode.data.outputs,
              ...connectedNode.data.nodeChannels,
            ].find(nodeSocket => {
              if (isOutput) {
                return connection.target.socketMetadataId === nodeSocket._id;
              }
              return connection.source.socketMetadataId === nodeSocket._id;
            });
            const editorIoName = `${connectedNodeSocket.name}::${connectedNodeSocket._id}${isOutput
              ? (connection.target.entryPoint ? `::${connection.target.entryPoint}` : '')
              : (connection.source.entryPoint ? `::${connection.source.entryPoint}` : '')}`;
            return {
              node: connectedNode.id,
              [editorIoKey]: editorIoName,
              data: {
                type: connection.type,
                source: {
                  nodeId: isOutput ? connection.source.graphNodeId : connectedNode.id,
                  name: isOutput ? socket.name : connectedNodeSocket.name,
                  socketId: isOutput ? socket.socket : connectedNodeSocket.socket,
                  metadataId: isOutput ? socket._id : connectedNodeSocket._id,
                },
                target: {
                  nodeId: isOutput ? connectedNode.id : connection.target.graphNodeId,
                  name: isOutput ? connectedNodeSocket.name : socket.name,
                  metadataId: isOutput ? connectedNodeSocket._id : socket._id,
                  socketId: isOutput ? connectedNodeSocket.socket : socket.socket,
                },
                pins: connection.pins,
              } as ConnectionData,
            };
          } catch (e) {
            return {};
          }
        }),
      };
    }
    return io;
  }

  private getNodesPositions(nodes: NodeModel[]) {
    let isPositionsExist = false;
    return nodes.reduce((result, node) => {
      if (GraphsService.isPositionInvalid(node.position)) {
        return isPositionsExist ? {
          ...result,
          positionsStatus: 'PARTIAL',
        } : {
          ...result,
          positionsStatus: 'UNCONFIGURED',
        };
      }

      isPositionsExist = true;
      return {
        ...result,
        positionsStatus: result.positionsStatus === 'UNCONFIGURED' ? 'PARTIAL' : result.positionsStatus,
        nodesX: [...result.nodesX, node.position[0]],
        nodesY: [...result.nodesY, GraphsService.calculateNodeY(node)],
      };
    }, {
      nodesX: [],
      nodesY: [],
      positionsStatus: 'CONFIGURED',
    });
  }

  private getNodePosition() {
    let position: number[];
    if (this.nodePositions.currentIndex < 5) {
      position = [this.nodePositions.currentX, this.nodePositions.currentY];

      this.nodePositions.currentIndex++;
      this.nodePositions.currentX += 500;
    } else {
      position = [this.nodePositions.currentX, this.nodePositions.currentY];

      this.nodePositions.currentIndex = 0;
      this.nodePositions.currentX = this.nodePositions.initX;
      this.nodePositions.currentY += 100;

    }
    return position;
  }

  public onTriggerReload() {
    this.triggerReload.next();
  }

  public subGraphCreated(subGraph: any) {
    this.onSubGraphCreate.next(subGraph);
  }

  public checkGraphStatus(graphId: string) {
    if (this.runningGraphsIds.includes(graphId)) {
      this.runningGraphsIds = this.runningGraphsIds.filter(id => id !== graphId);
      return;
    }
    this.runningGraphsIds.push(graphId);
  }

  public setGraph(graph: Graph | ServiceGraph) {
    this.graph = graph;
    this._graphChanged$.next(graph);
  }

  public setOrganization(organization: any) {
    this.organization = organization;
  }

  public getGraph() {
    return this.graph;
  }

  public showGraphBuild(graph) {
    this.onShowGraphBuild.next(graph);
  }

  public onGraphTemplateFormChange(formValue: { name: string, runtime: string }) {
    this.graphTemplateFormChanged.next(formValue);
  }

  public goToSubGraph(subGraphId: string, isServiceSubGraph: boolean, core: boolean) {
    const isOnService = this.router.url.includes('service') && !this.router.url.includes('sub-graph');
    const isOnSubgraph = this.router.url.includes('sub-graph');
    if (isOnSubgraph || isOnService) {
      const route = this.router.url.split('/sub-graph/')[0];
      this.navigate(`${route}/sub-graph/${subGraphId}`);
      return;
    }
    this.navigate(`${this.router.url}/${isServiceSubGraph ? 'service' : 'sub-graph'}/${subGraphId}`);
  }

  navigate(url: string) {
    this.ngZone.run(() => {
      this.router.navigateByUrl(url);
    });
  }

  public isNodesNamesUnique(nodes: GraphNode[]) {
    const relevantNodes = nodes.filter((graphNode: any) => !(graphNode.type === NodeType.IMAGE || graphNode.type === NodeType.TEXTAREA) &&
      graphNode.node?.type !== 'DEVICE_NODE' && !graphNode.graph?.reference && !graphNode.mapping);
    const nodesNames = relevantNodes.map(node => node.graphNodeName) as string[];
    const unique = nodesNames.filter(name => {
      return nodesNames.indexOf(name) === nodesNames.lastIndexOf(name);
    });
    const duplicated = relevantNodes
      .filter(node => !unique.includes(node.graphNodeName))
      .map(({ _id, graphNodeName }) => ({ id: _id, name: graphNodeName }));
    if (duplicated.length) {
      this.duplicatedNodesCollection = duplicated;
      this.duplicatedNodes.next(duplicated);
      return false;
    }
    return true;
  }

  public checkNodeNameDuplicates(nodeName: string, nodeId: string) {
    const nodesNames = [];
    this.duplicatedNodesCollection = this.duplicatedNodesCollection
      .map(node => {
        if (node.id === nodeId) {
          nodesNames.push(nodeName);
          return {
            name: nodeName,
            id: nodeId,
          };
        }
        nodesNames.push(node.name);
        return node;
      }).filter(node => nodesNames.filter(name => name === node.name).length >= 2);
    this.duplicatedNodes.next(this.duplicatedNodesCollection);
  }

  public isIoHasConnection(io: IO): boolean {
    const { id } = getIoMetadataFromKey(io.key);
    return this.graph?.connections?.some(c => c.source.socketMetadataId === id || c.target.socketMetadataId === id);
  }

  public isConnectionAlreadyCreated(data: ConnectionData): boolean {
    return this.graph?.connections?.some(connection => {
      const sourcesEqual = connection.source.socketMetadataId === data.source.metadataId;
      const targetsEqual = connection.target.socketMetadataId === data.target.metadataId;
      return targetsEqual && sourcesEqual;
    });
  }
}
