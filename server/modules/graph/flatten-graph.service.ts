import Container, { Service } from 'typedi';
import { TransporterService, Transporter } from '@aitheon/transporter';
import { DEFAULT_PROJECT_NODE_POPULATION, DEFAULT_DEVICE_POPULATION } from '../shared/shared.service';
import { environment } from '../../environment';
import { GraphConnection, ConnectionType, SocketJunctionPoint, GraphSchema, Graph } from './graph.model';
import { MappingNode } from './mapping-node.model';
import { FunctionalGraphNode, SubgraphGraphNode } from './graph-nodes.model';
import { FlattenGraph, FlattenConnection, FlattenGraphNode, FlattenMappingNode } from './flatten-graph.model';
import { Runtime } from '../sockets/socket-group.model';
import { SocketMetadata } from '../nodes/node.model';

@Service()
@Transporter()
export class FlattenGraphService extends TransporterService {

  buildServerServiceId = `BUILD_SERVER${environment.production ? '' : ''}`;

  creatorsStudioServerServiceId = `CREATORS_STUDIO${environment.production ? '' : ''}`;

  constructor() {
    super(Container.get('TransporterBroker'));
  }

  async getFlattenGraph(graph: Graph, isOrgGraph: boolean) {
    const allGraphs = await this.getAllGraphs(graph.organization);

    const resultGraphConnections = [] as GraphConnection[];
    const tempGraphConnections = [] as GraphConnection[];
    const mappingSourceGraphConnections = [] as GraphConnection[];
    const mappingTargetGraphConnections = [] as GraphConnection[];

    graph.connections.forEach((connection: GraphConnection) => {
      if (connection.source.type === ConnectionType.NODE && connection.target.type === ConnectionType.NODE) {
        resultGraphConnections.push(connection);
      } else if (connection.source.type === ConnectionType.MAPPING) {
        mappingSourceGraphConnections.push(connection);
      } else if (connection.target.type === ConnectionType.MAPPING) {
        mappingTargetGraphConnections.push(connection);
      } else if (connection.source.type === ConnectionType.SUBGRAPH || connection.target.type === ConnectionType.SUBGRAPH) {
        tempGraphConnections.push(connection);
      }
    });

    if (mappingSourceGraphConnections.length && mappingTargetGraphConnections.length && graph.mappingNodes.length) {
      mappingSourceGraphConnections.forEach((sourceConnection: GraphConnection) => {
        const targetConnection = mappingTargetGraphConnections.find((c: GraphConnection) => {
          return sourceConnection.source.graphNodeId.toString() === c.target.graphNodeId.toString();
        });

        const mappingNode = graph.mappingNodes.find((mappingNode: MappingNode) => mappingNode._id.toString() === sourceConnection.source.graphNodeId.toString());

        if (!mappingNode) {
          throw new Error('Mapping node must be on a graph');
        }

        const generatedConnection = { ...targetConnection, target: sourceConnection.target, mappingNodeId: mappingNode._id } as GraphConnection;

        if (generatedConnection.source.type === ConnectionType.NODE && generatedConnection.target.type === ConnectionType.NODE) {
          resultGraphConnections.push(generatedConnection);
          graph.graphNodes.forEach((graphNode: FunctionalGraphNode) => {
            if (graphNode._id.toString() === generatedConnection.source.graphNodeId.toString()) {
              graphNode.mappingNodes = graphNode.mappingNodes || [];
              const existingNode = graphNode.mappingNodes.find((m: MappingNode) => m._id.toString() === mappingNode._id.toString());
              if (!existingNode) graphNode.mappingNodes.push(mappingNode);
            }
          });
        } else {
          // TO_DO: need to cover connections with mapping node that goes to another subgraph
          tempGraphConnections.push(generatedConnection);
        }
      });
    }


    const resultNodes = graph.graphNodes.map((node: FunctionalGraphNode) => this.getFlattenNode(node, graph._id));

    const temporaryGraph = {
      resultConnections: resultGraphConnections,
      tempConnections: tempGraphConnections,
      resultNodes,
      temporaryNodes: graph.subgraphNodes,
      systemSubgraphIds: [],
      deviceNodeIds: [],
    } as any;

    if ((graph as any).serviceGraphNode) {
      const serviceNode = this.getFlattenNode((graph as any).serviceGraphNode, graph._id);
      temporaryGraph.resultNodes.push(serviceNode);
    }

    const parsedGraph = this.getParsedGraph(temporaryGraph, allGraphs);
    const flattenConnections = this.getFlattenConnections(parsedGraph);

    const result = {
      organization: graph.organization,
      graphNodes: parsedGraph.resultNodes,
      connections: flattenConnections
    } as FlattenGraph;

    if (!isOrgGraph) {
      result.graphId = graph._id;
    }

    return result;
  }

  getNextIteration(graph: any, allGraphs: Graph[]) {
    const temporaryGraph = {
      resultConnections: graph.resultConnections,
      tempConnections: [],
      resultNodes: graph.resultNodes,
      temporaryNodes: []
    } as any;

    const tempConnections = graph.tempConnections;
    const tempNodes = graph.temporaryNodes;
    graph.temporaryNodes.forEach((subGraphNode: SubgraphGraphNode) => {
      const subGraph = allGraphs.find((graphItem: Graph) => {
        return graphItem._id.toString() === subGraphNode.graph.toString();
      }) as any;

      if (subGraph.runtime !== Runtime.AOS_CLOUD) {
        // TO_DO: Create logic for AOS and AOS_EMBEDDED runtimes
        // if system add Id to systemSubgraphIds
        // return;
      }

      // If Graph is disabled no need to add nodes from it
      if (subGraph.disabled) {
        return;
      }


      const mappingSourceGraphConnections = [] as GraphConnection[];
      const mappingTargetGraphConnections = [] as GraphConnection[];

      subGraph.connections.forEach((connection: GraphConnection) => {
        if (connection.source.type === ConnectionType.NODE && connection.target.type === ConnectionType.NODE) {
          temporaryGraph.resultConnections.push(connection);
        } else if (connection.source.type === ConnectionType.MAPPING) {
          mappingSourceGraphConnections.push(connection);
        } else if (connection.target.type === ConnectionType.MAPPING) {
          mappingTargetGraphConnections.push(connection);
        } else if ((connection.source.type === ConnectionType.SUBGRAPH
          || connection.target.type === ConnectionType.SUBGRAPH)
          && (connection.source.type !== ConnectionType.INTERFACE)
          && (connection.target.type !== ConnectionType.INTERFACE)) {
          temporaryGraph.tempConnections.push(connection);
        }
      });

      if (mappingSourceGraphConnections.length && mappingTargetGraphConnections.length && subGraph.mappingNodes.length) {
        mappingSourceGraphConnections.forEach((sourceConnection: GraphConnection) => {
          const targetConnection = mappingTargetGraphConnections.find((c: GraphConnection) => {
            return sourceConnection.source.graphNodeId.toString() === c.target.graphNodeId.toString();
          });
          const mappingNode = subGraph.mappingNodes.find((mappingNode: MappingNode) => mappingNode._id.toString() === sourceConnection.source.graphNodeId.toString());

          if (!mappingNode) {
            throw new Error('Mapping node must be on a graph');
          }

          const generatedConnection = { source: targetConnection.source, target: sourceConnection.target, type: targetConnection.type, mappingNodeId: mappingNode._id } as GraphConnection;

          if (generatedConnection.source.type === ConnectionType.NODE && generatedConnection.target.type === ConnectionType.NODE) {
            temporaryGraph.resultConnections.push(generatedConnection);
            subGraph.graphNodes.forEach((graphNode: FunctionalGraphNode) => {
              if (graphNode._id.toString() === generatedConnection.source.graphNodeId.toString()) {
                graphNode.mappingNodes = graphNode.mappingNodes || [];
                const existingNode = graphNode.mappingNodes.find((m: MappingNode) => m._id.toString() === mappingNode._id.toString());
                if (!existingNode) graphNode.mappingNodes.push(mappingNode);
              }
            });
          } else {
            // TO_DO: need to cover connections with mapping node that goes to another subgraph
            temporaryGraph.tempConnections.push(generatedConnection);
          }
        });
      }

      const resultNodes = subGraph.graphNodes.map((node: FunctionalGraphNode) => this.getFlattenNode(node, subGraph._id));
      temporaryGraph.resultNodes.push(...resultNodes);
      temporaryGraph.temporaryNodes.push(...subGraph.subgraphNodes);

      if (subGraph.serviceGraphNode) {
        const serviceNode = this.getFlattenNode(subGraph.serviceGraphNode, subGraph._id);
        temporaryGraph.resultNodes.push(serviceNode);
      }
    });

    tempConnections.forEach((connection: GraphConnection) => {
      const target = connection.target;
      const source = connection.source;

      const resultSource = this.getJunctionPoint(source, 'SOURCE', tempNodes, allGraphs);
      const resultTarget = this.getJunctionPoint(target, 'TARGET', tempNodes, allGraphs);

      if (!resultTarget || !resultSource) {
        return;
      }

      const resultConnection = { source: resultSource, target: resultTarget, type: connection.type };

      if (resultSource.type === ConnectionType.NODE && resultTarget.type === ConnectionType.NODE) {
        return temporaryGraph.resultConnections.push(resultConnection);
      }

      return temporaryGraph.tempConnections.push(resultConnection);
    });


    return temporaryGraph;
  }

  getParsedGraph(graph: any, allGraphs: Graph[]): any {
    const temporaryGraph = this.getNextIteration(graph, allGraphs);

    if (temporaryGraph.tempConnections.length === 0 && temporaryGraph.temporaryNodes.length === 0) {
      return temporaryGraph;
    }

    return this.getParsedGraph(temporaryGraph, allGraphs);
  }

  getJunctionPoint(point: SocketJunctionPoint, type: string, temporaryNodes: any[], allGraphs: Graph[]) {
    if (point.type === ConnectionType.NODE) {
      return point;
    }

    const subGraphNode = temporaryNodes.find((subGraphNode: SubgraphGraphNode) => {
      return subGraphNode._id.toString() === point.graphNodeId.toString();
    });

    const subGraph = allGraphs.find((g: Graph) => {
      return g._id.toString() === subGraphNode.graph.toString();
    }) as any;

    // If Graph is disabled no need to add connections from it
    if (subGraph.disabled) {
      return undefined;
    }

    const targetConnection = subGraph.connections.find((connection: GraphConnection) => {
      if (type === 'TARGET') {
        return (connection.source.socketMetadataId.toString() === point.socketMetadataId.toString());
      } else if (type === 'SOURCE') {
        return (connection.target.socketMetadataId.toString() === point.socketMetadataId.toString());
      }
    });

    if (!targetConnection) {
      return undefined;
    }

    return type === 'TARGET' ? targetConnection.target : targetConnection.source;
  }

  async getAllGraphs(organization: string) {
    return GraphSchema.find({ organization }).populate(DEFAULT_PROJECT_NODE_POPULATION).populate('serviceGraphNode.node').populate(DEFAULT_DEVICE_POPULATION);
  }

  async setGraphStatus(graphId: string, status: string) {
    return GraphSchema.findByIdAndUpdate(graphId, { status });
  }


  getFlattenConnections(flattenGraph: any): FlattenConnection[] {
    const flattenConnections = flattenGraph.resultConnections.map((connection: GraphConnection) => {
      const sourceNode = flattenGraph.resultNodes.find((n: any) => n._id.toString() === connection.source.graphNodeId.toString());
      const targetNode = flattenGraph.resultNodes.find((n: any) => n._id.toString() === connection.target.graphNodeId.toString());

      let output, input;
      switch (connection.type) {
        case 'EVENT':
          output = sourceNode ? sourceNode.node.outputs.find((o: SocketMetadata) => o._id.toString() === connection.source.socketMetadataId.toString()) : '';
          input = targetNode ? targetNode.node.inputs.find((i: SocketMetadata) => i._id.toString() === connection.target.socketMetadataId.toString()) : '';
          break;

        case 'CHANNEL':
          output = sourceNode ? sourceNode.node.nodeChannels.find((o: SocketMetadata) => o._id.toString() === connection.source.socketMetadataId.toString()) : '';
          input = targetNode ? targetNode.node.nodeChannels.find((i: SocketMetadata) => i._id.toString() === connection.target.socketMetadataId.toString()) : '';
          break;
      }

      return {
        type: connection.type,
        source: {
          graphNode: connection.source.graphNodeId,
          output
        },
        target: {
          graphNode: connection.target.graphNodeId,
          input
        },
        mappingNodeId: connection.mappingNodeId
      } as FlattenConnection;
    });

    return flattenConnections;
  }

  async generateFlattenGraphNode(graphNodeId: string, updateToLatestRelease: boolean ): Promise<FlattenGraphNode> {
    const graph = await GraphSchema.findOne({graphNodes: {$elemMatch: {_id: graphNodeId}}}).populate(DEFAULT_PROJECT_NODE_POPULATION).populate(DEFAULT_DEVICE_POPULATION).lean() as Graph;
    const graphNode = graph.graphNodes.find((node: FunctionalGraphNode) => node._id.toString() === graphNodeId);

    // Updating to latest release for redeploy graph node
    if (updateToLatestRelease) {
      const release = await this.broker.call(this.creatorsStudioServerServiceId + '.ReleasesService.getLatestReleaseByProjectId', { projectId: graphNode.node.project._id });
      await this.updateGraphNode(graph._id, graphNodeId, release);
      graphNode.release = release;
    }

    return await this.getFlattenNode(graphNode, graph._id);
  }


  async updateGraphNode(graphId: string, graphNodeId: string, release: any) {
    return await GraphSchema.findOneAndUpdate({ _id: graphId, 'graphNodes._id': graphNodeId }, { $set: { 'graphNodes.$.release': release }}).lean();
  }

  getFlattenNode(graphNode: FunctionalGraphNode, graphId: string) {
    const { _id, type, runtime, name, project, service } = graphNode.node;

    let release, inputs, outputs, nodeChannels;
    const settings = {} as any;

    // In case of node has release data
    if (!!graphNode.release) {
      inputs = graphNode.release.inputs;
      outputs = graphNode.release.outputs;
      nodeChannels = graphNode.release.nodeChannels;
      release = graphNode.release._id;
    }

    // In case of node hasn`t release data
    else {
      inputs = graphNode.node.inputs;
      outputs = graphNode.node.outputs;
      nodeChannels = graphNode.node.nodeChannels;
      release = graphNode.node.release;
    }

    if (graphNode.instanceVariables && graphNode.instanceVariables.settings) {
      const parameters = graphNode.instanceVariables.settings.parameters;
      if (parameters && parameters.length) {
        settings.settingParams = parameters.map((param: { name: string, value: string }) => {
          return { name: param.name, default: param.value };
        });
      }

      settings.ticks = graphNode.instanceVariables.settings.ticks || [];
    }

    if (graphNode.mappingNodes && graphNode.mappingNodes.length) {
      settings.mappingNodes = graphNode.mappingNodes.map(m => this.parseFlattenMappingNode(m));
    }

    const specialReference = graphNode.project || graphNode.jobSiteProject;

    const result = {
      _id: graphNode._id,
      graphId,
      settings,
      device: graphNode.device,
      specialReference,
      node: {
        _id,
        name,
        type,
        runtime,
        project,
        release,
        service,
        inputs,
        outputs,
        nodeChannels
      }
    } as FlattenGraphNode;
    return result;
  }

  parseFlattenMappingNode(mappingNode: MappingNode): FlattenMappingNode {
    return {
      _id: mappingNode._id,
      mapping: mappingNode.mapping,
      staticFields: mappingNode.staticFields,
      customFields: mappingNode.customFields
    } as FlattenMappingNode;
  }

}
