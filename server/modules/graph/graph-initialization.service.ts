import { Container, Service as TypediService } from 'typedi';
import { Runtime } from '../nodes/node-group.model';
import { ServiceNode, ServiceNodeSchema } from '../nodes/node-service.model';
import { NodeType, SocketMetadata } from '../nodes/node.model';
import { Service } from '../shared/interfaces';
import { SharedService } from '../shared/shared.service';
import { ServiceGraphNode, SubgraphGraphNode } from './graph-nodes.model';
import {
  ConnectionType,
  GraphConnection,
  GraphSchema,
  GraphType,
  IGraph,
  ServiceGraph,
  ServiceGraphSchema,
  GraphStatus,
  Graph
} from './graph.model';
import { logger } from '@aitheon/core-server';

@TypediService()
export class GraphInitializationService {


  private sharedService: SharedService;

  constructor() {
    this.sharedService = Container.get(SharedService);
  }

  async initCoreServices(organization: string, type: string = GraphType.ORGANIZATION) {
    const services = await this.sharedService.getOrganizationCoreServices() as Service[];
    const organizationGraph = await GraphSchema.findOne({ organization, type }).lean();
    const newSubgraphNodes = await Promise.all(services.map(async (service: any) => {
      return await this.createServiceGraphNodes(service._id, organizationGraph, organization);
    }));
    await GraphSchema.findOneAndUpdate({ organization, type }, { $push: { subgraphNodes: { $each: newSubgraphNodes } }});
  }

  async addService( service: string, organization: string, orgGraphType: string) {
    logger.info('[addService]', organization, service);

    // OLD logic for dividing SI to 3 subgraphs
    // if (service === 'SMART_INFRASTRUCTURE') {
    //   const smartServices = Object.keys(InfrastructureType);
    //   return smartServices.forEach(async s => {
    //     await this.addService(s, organization, orgGraphType);
    //   });
    // }

    // Check if already added
    const serviceGraph = await ServiceGraphSchema.findOne({ organization, service, core: orgGraphType === GraphType.CORE });
    logger.info('[serviceGraph]', serviceGraph);
    if (serviceGraph) {
      return await ServiceGraphSchema.findByIdAndUpdate(serviceGraph._id, { disabled: false }, { new: true });
    }
    const organizationGraph = await GraphSchema.findOne({ organization, type: orgGraphType });
    const newGraphNode = await this.createServiceGraphNodes(service, organizationGraph, organization);
    logger.info('[newGraphNode]', newGraphNode);
    return await GraphSchema.findOneAndUpdate({ organization, type: orgGraphType }, { $push: { subgraphNodes: newGraphNode }});
  }

  private async createServiceGraphNodes(service: string, organizationGraph: IGraph, organization: string = '') {
    let serviceNode = await ServiceNodeSchema.findOne({ service });
    // the below is only temporary, serviceNode should be created when it's built
    if (!serviceNode) {
      serviceNode = await ServiceNodeSchema.create({
        name: service,
        type: NodeType.SERVICE_NODE,
        service,
        description: 'Created for testing, do not use this',
        runtime: Runtime.AOS_CLOUD
      });
    }
    const serviceGraph = await this.createServiceGraph(serviceNode, service, organization, organizationGraph);
    const subgraphGraphNode = await this.createServiceSubgraphNode(serviceGraph._id.toString(), service);
    await this.createServiceGraphConnections(serviceGraph, serviceNode);
    return subgraphGraphNode;
  }

  private async createServiceGraph(serviceNode: ServiceNode, service: string, organization: string, orgGraph: Graph) {
    const serviceGraph = new ServiceGraph();
    const serviceGraphNode = new ServiceGraphNode();
    serviceGraphNode.graphNodeName = service;
    serviceGraphNode.node = serviceNode._id.toString();
    serviceGraph.name = service;
    serviceGraph.serviceGraphNode = serviceGraphNode;
    serviceGraph.service = service;
    serviceGraph.organization = organization;
    serviceGraph.type = GraphType.SERVICE;
    serviceGraph.runtime = Runtime.AOS_CLOUD;
    serviceGraph.graphNodes = [];
    serviceGraph.subgraphNodes = [];
    serviceGraph.connections = [];
    serviceGraph.inputs = this.createServiceGraphIo(serviceNode.inputs, orgGraph.type);
    serviceGraph.outputs = this.createServiceGraphIo(serviceNode.outputs, orgGraph.type);
    serviceGraph.parent = orgGraph._id;
    serviceGraph.status = GraphStatus.SAVED;
    serviceGraph.core = orgGraph.type === GraphType.CORE;
    return ServiceGraphSchema.create(serviceGraph);
  }

  private async createServiceGraphConnections(serviceGraph: ServiceGraph, serviceNode: ServiceNode) {
    const connections: GraphConnection[] = [];

    const { inputs: graphInputs, outputs: graphOutputs } = serviceGraph;
    const { inputs: nodeInputs, outputs: nodeOutputs } = serviceNode;

    for (const input of graphInputs) {
      const nodeInput = nodeInputs
        .find(({ name, socket }) => (name === input.name && socket.toString() === input.socket.toString()));
      if (nodeInput) {
        connections.push({
          source: {
            graphNodeId: serviceGraph._id.toString(),
            socketMetadataId: input._id.toString(),
            type: ConnectionType.INTERFACE,
          },
          target: {
            graphNodeId: serviceGraph.serviceGraphNode._id.toString(),
            socketMetadataId: nodeInput._id.toString(),
            type: ConnectionType.NODE,
          },
          pins: [],
        } as GraphConnection);
      }
    }
    for (const output of graphOutputs) {
      const nodeOutput = nodeOutputs
        .find(({ name, socket }) => (name === output.name && socket.toString() === output.socket.toString()));
      if (nodeOutput) {
        connections.push({
          source: {
            graphNodeId: serviceGraph.serviceGraphNode._id.toString(),
            socketMetadataId: nodeOutput._id.toString(),
            type: ConnectionType.NODE,
          },
          target: {
            graphNodeId: serviceGraph._id.toString(),
            socketMetadataId: output._id.toString(),
            type: ConnectionType.INTERFACE,
          },
          pins: [],
        } as GraphConnection);
      }
    }

    await GraphSchema.findByIdAndUpdate(serviceGraph._id.toString(), { connections });
  }

  private createServiceGraphIo(io: SocketMetadata[] = [], orgGraphType: string): SocketMetadata[] {
    if (orgGraphType !== GraphType.CORE) {
      io = io.filter(target => !target.core);
    }
    return io.map(ioItem => ({
      name: ioItem.name,
      multiple: true,
      socket: ioItem.socket,
    } as SocketMetadata));
  }

  async createServiceSubgraphNode(serviceGraphId: string, service: string): Promise<SubgraphGraphNode> {
    const serviceSubGraphNode = new SubgraphGraphNode();
    serviceSubGraphNode.graphNodeName = service;
    serviceSubGraphNode.position = [];
    serviceSubGraphNode.graph = serviceGraphId;
    return serviceSubGraphNode;
  }

}
