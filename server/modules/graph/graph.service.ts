import { logger, Current } from '@aitheon/core-server';
import { Event, Transporter, TransporterService } from '@aitheon/transporter';
import { Container, Service, Inject } from 'typedi';
import { Runtime } from '../nodes/node-group.model';
import { SocketMetadata, NodeType, Node } from '../nodes/node.model';
import { ServiceDeploymentsService } from '../service-deployments/service-deployments.service';
import { IsaacPackage, IsaacPackageBuilderFactory } from '../shared/isaac/isaac-package-builder-factory';
import { FlattenGraph, FlattenGraphNode } from './flatten-graph.model';
import { GraphInitializationService } from './graph-initialization.service';
import { InfrastructureApi, StationsApi } from '@aitheon/smart-infrastructure-server';
import { FunctionalGraphNode, SubgraphGraphNode, GraphNodeStatus, GraphNode, UpdateUIElements, SubgraphNodeStatuses } from './graph-nodes.model';
import {
  ConnectionType,
  Graph,
  GraphConnection,
  GraphSchema,
  GraphType,
  ServiceGraph,
  ServiceGraphSchema,
  SocketJunctionPoint,
  LinkedGraph,
  LinkedGraphSchema,
  GraphStatus,
  GraphSubType,
  SubgraphCreation,
  IGraph,
  RemoveDevice,
  GraphRefType,
  DevicesFromStation,
  DevicesToSubgraph,
  ControllerFromOrg,
  ControllerToSubgraph,
  SpecialSubgraphCreation,
  SpecialServiceType,
  SubgraphCreationByRef
} from './graph.model';
import { environment } from '../../environment';
import { ObjectID, ObjectId } from 'bson';
import { FunctionalNode, IFunctionalNode, FunctionalNodeSchema } from '../nodes/node-functional.model';
import { ServiceNodeSchema, ServiceNode } from '../nodes/node-service.model';
import { ProjectsApi } from '@aitheon/creators-studio-server';
import { ProjectSchema, ProjectType } from '../shared/project.model';
import { Release } from '@aitheon/creators-studio-server';
import { ProjectsApi as PMProjectsApi } from '@aitheon/project-manager-server';
import { JobSiteProjectsApi, SitesApi } from '@aitheon/job-site-server';
import { SharedService, DEFAULT_DEVICE_POPULATION, DEFAULT_PROJECT_NODE_POPULATION } from '../shared/shared.service';
import { Device, DeviceSchema } from '../shared/device.model';
import { FlattenGraphService } from './flatten-graph.service';
import * as _ from 'lodash';

@Service()
@Transporter()
export class GraphsService extends TransporterService {

  @Inject(() => FlattenGraphService)
  flattenGraphService: FlattenGraphService;

  @Inject(() => ServiceDeploymentsService)
  serviceDeploymentsService: ServiceDeploymentsService;

  @Inject(() => GraphInitializationService)
  graphInitializationService: GraphInitializationService;

  @Inject(() => SharedService)
  sharedService: SharedService;

  projectsApi: ProjectsApi;

  pMprojectsApi: PMProjectsApi;

  jobSiteProjectsApi: JobSiteProjectsApi;

  sitesApi: SitesApi;

  infrastructureApi: InfrastructureApi;

  stationsApi: StationsApi;

  buildServerServiceId = `BUILD_SERVER${environment.production ? '' : '_DEV'}`;

  creatorsStudioServerServiceId = `CREATORS_STUDIO${environment.production ? '' : '_DEV'}`;

  constructor() {
    super(Container.get('TransporterBroker'));
    this.projectsApi = new ProjectsApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/creators-studio`);
    this.pMprojectsApi = new PMProjectsApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/project-manager`);
    this.infrastructureApi = new InfrastructureApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/smart-infrastructure`);
    this.stationsApi = new StationsApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/smart-infrastructure`);
    this.jobSiteProjectsApi = new JobSiteProjectsApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/job-site`);
    this.sitesApi = new SitesApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/job-site`);
  }

  async buildIsaacPackageById(graphId: string): Promise<IsaacPackage> {
    const graph = await this.findById(graphId);
    const isaacPkgBuilder = IsaacPackageBuilderFactory.createGraphBuilder(graph);
    isaacPkgBuilder.buildAll();
    return { app: isaacPkgBuilder.getIsaacApp(), build: isaacPkgBuilder.getBazelBuild() };
  }

  async buildIsaacSubgraphPackageById(graphId: string): Promise<IsaacPackage> {
    const graph = await this.findById(graphId);
    const isaacPkgSubgraphBuilder = IsaacPackageBuilderFactory.createSubgraphBuilder(graph);
    isaacPkgSubgraphBuilder.buildAll();
    return { app: isaacPkgSubgraphBuilder.getIsaacApp(), build: isaacPkgSubgraphBuilder.getBazelBuild() };
  }

  async findById(graphId: string): Promise<Graph> {
    return await GraphSchema.findById(graphId)
      .populate('graphNodes.node', '-templateVariables')
      .populate('graphNodes.device', '-ssh')
      .populate(DEFAULT_PROJECT_NODE_POPULATION).populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections')
      .populate('serviceGraphNode.node').lean();
  }

  async findByGraphNodeId(graphNodeId: string): Promise<Graph> {
      return await GraphSchema
        .findOne({ graphNodes: { $elemMatch: { _id: graphNodeId } } })
        .populate(DEFAULT_PROJECT_NODE_POPULATION)
        .populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections')
        .populate('graphNodes.device', '-ssh')
        .populate('serviceGraphNode.node').lean();
  }

  async findByService(serviceId: string, organization: string): Promise<ServiceGraph> {
    return await GraphSchema
      .findOne({ organization, service: serviceId, type: GraphType.SERVICE })
      .populate(DEFAULT_PROJECT_NODE_POPULATION)
      .populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections')
      .populate('graphNodes.device', '-ssh')
      .populate('serviceGraphNode.node').lean();
  }

  async checkAlreadyExistedServiceNode(service: string, graphId: string) {
    const serviceNode = await ServiceNodeSchema.findOne({ service, type: NodeType.SERVICE_NODE }).lean();
    if (!serviceNode) return;

    await ServiceGraphSchema.findByIdAndUpdate(graphId, { $set: { 'serviceGraphNode.node': serviceNode._id } });
    return serviceNode;
  }

  async findOrgGraph(organization: string): Promise<Graph> {
    const graph = GraphSchema
      .findOne({ organization, type: GraphType.ORGANIZATION })
      .populate('graphNodes.node', '-templateVariables')
      .populate('graphNodes.device', '-ssh')
      .populate(DEFAULT_PROJECT_NODE_POPULATION)
      .populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections')
      .lean();

    return graph;
  }

  async findCoreGraph(): Promise<Graph> {
    return GraphSchema
      .findOne({ type: GraphType.CORE })
      .populate('graphNodes.node', '-templateVariables')
      .populate('graphNodes.device', '-ssh')
      .populate(DEFAULT_PROJECT_NODE_POPULATION)
      .populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections').lean();
  }

  // method for Infrastructure, Floor, Station graphs
  async findByReference(reference: string, subType: GraphSubType, findByReference: boolean = false, checkIsLatest: boolean = false): Promise<Graph> {
    const graph = await GraphSchema.findOne({ reference, subType }).populate('graphNodes.node').lean() as any;

    if (findByReference || checkIsLatest) {
      graph.graphNodes = await this.getParsedApplicationsFromGraphNodes(graph.graphNodes, findByReference, checkIsLatest);
    }

    return graph;
  }

  getParsedApplicationsFromGraphNodes(graphNodes: FunctionalGraphNode[], findByReference: boolean, checkIsLatest: boolean): Promise<any> {
    return Promise.all(graphNodes.map(async (graphNode: any) => {
      if (graphNode.release && graphNode.release.project) {
        const project = findByReference ? await ProjectSchema.findById(graphNode.release.project).lean() :
          graphNode.release.project;

        if (checkIsLatest) {
          graphNode.isLatest = await this.checkIfGraphNodeHasLatestRelease(graphNode);
        }

        return {
          ...graphNode,
          release: {
            ...graphNode.release,
            project
          }
        };
      }

      return graphNode;
    }));
  }

  async checkIfGraphNodeHasLatestRelease(graphNode: FunctionalGraphNode) {
    const node = graphNode.node;
    let isLatest = true;
    if (node && node.project) {
      const releases = await this.broker.call<any[]>(this.creatorsStudioServerServiceId + '.ReleasesService.findByProject', { projectId: node.project._id });
      // @ts-ignore
      const sortReleases = releases.filter(r => r.visibility === 'PRODUCTION').sort((a: any, b: any) => new Date(b.createdAt) - new Date(a.createdAt));
      const latest = sortReleases[0];
      if (latest) {
        isLatest = !graphNode.release ? false : latest._id.toString() === graphNode.release._id.toString();
      }
    }
    return isLatest;
  }

  async setOrgGraphsStatus(organization: string, status: string) {
    return GraphSchema.updateMany({ organization }, { $set: { status } });
  }

  async populateReference(reference: string, subType: string, token: string, organization: string, service: SpecialServiceType): Promise<any> {
    let result = {} as any;

    switch (subType) {
      case GraphSubType.INFRASTRUCTURE:
        result = await this.getInfrastructureById(reference, token, organization);
        break;
      case GraphSubType.FLOOR:
        result = await this.getFloorById(reference, token, organization);
        break;
      case GraphSubType.STATION:
        result = await this.getStationById(reference, token, organization);
        break;
      case GraphSubType.SPECIAL:
        result = await this.getSpecialById(reference, token, organization, service);
        break;
      case GraphSubType.CONTROLLER:
        result = await this.getDeviceById(reference, token, organization);
        break;
      case GraphSubType.SITE:
        result = await this.getSiteById(reference, token, organization);
        break;
    }

    return result;
  }

  async getInfrastructureById(id: string, token: string, organization: string) {
    const infraRes = await this.infrastructureApi.getById(id, { headers: { 'Authorization': `JWT ${token}`, 'organization-id': organization } });
    return infraRes.body;
  }

  async getFloorById(id: string, token: string, organization: string) {
    const floorRes = await this.infrastructureApi.getFloorById(id, { headers: { 'Authorization': `JWT ${token}`, 'organization-id': organization } });
    return floorRes.body;
  }

  async getStationById(id: string, token: string, organization: string) {
    const stationRes = await this.stationsApi.getById(id, { headers: { 'Authorization': `JWT ${token}`, 'organization-id': organization } });
    return stationRes.body;
  }

  async getSiteById(id: string, token: string, organization: string) {
    return (await this.sitesApi.getById(id, { headers: { 'Authorization': `JWT ${token}`, 'organization-id': organization } })).body;
  }

  async getSpecialById(id: string, token: string, organization: string, service: SpecialServiceType) {
    let result;

    switch (service) {
      case SpecialServiceType.PROJECT_MANAGER:
        result = (await this.pMprojectsApi.getById(id, false, { headers: { 'Authorization': `JWT ${token}`, 'organization-id': organization } })).body;
        break;
      case SpecialServiceType.JOB_SITE:
        result = (await this.jobSiteProjectsApi.getById(id, { headers: { 'Authorization': `JWT ${token}`, 'organization-id': organization } })).body;
        break;
    }

    return result;
  }

  // TEMPORARY: rework when device manager will be new template
  async getDeviceById(id: string, token: string, organization: string) {
    return await DeviceSchema.findById(id).select('-ssh').lean();
  }

  async stopGraph(organization: string): Promise<Graph> {

    const graph = await GraphSchema.findOne({
      organization,
      type: GraphType.ORGANIZATION
    }).populate(DEFAULT_PROJECT_NODE_POPULATION).populate(DEFAULT_DEVICE_POPULATION).lean();

    const flattenGraph = await this.flattenGraphService.getFlattenGraph(graph, true);

    await this.setOrgGraphsStatus(organization, GraphStatus.TERMINATED);

    this.broker.emit(`GraphsService.stop`, flattenGraph, this.buildServerServiceId);

    return graph;
  }

  async stopSubGraph(graphId: string): Promise<FlattenGraph> {

    const graph = await GraphSchema.findById(graphId).populate(DEFAULT_PROJECT_NODE_POPULATION).populate(DEFAULT_DEVICE_POPULATION).lean();

    const flattenGraph = await this.flattenGraphService.getFlattenGraph(graph, false);

    await this.flattenGraphService.setGraphStatus(graphId, GraphStatus.TERMINATED);

    this.broker.emit(`GraphsService.stop`, flattenGraph, this.buildServerServiceId);

    return flattenGraph;
  }

  async getBySearch(body: any): Promise<Graph> {

    const query = { ...body } as any;

    if (body.organization) {
      query.organization = body.organization;
    } else {
      // tslint:disable-next-line:no-null-keyword
      query.organization = { $eq: null };
    }

    const graph = await GraphSchema.findOne(query)
      .populate('graphNodes.node', '-templateVariables')
      .populate(DEFAULT_PROJECT_NODE_POPULATION).populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections')
      .populate('serviceGraphNode.node');
    return graph;
  }

  async findAll(organization: string): Promise<Graph[]> {
    const graphs = await GraphSchema.find({ organization })
      .populate('graphNodes.node', '-templateVariables')
      .populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections');
    return graphs;
  }

  async create(graph: Graph): Promise<Graph> {
    if (this.isServiceGraph(graph)) {
      return await ServiceGraphSchema.create(graph);
    }
    return await GraphSchema.create(graph);
  }

  async createInfrastructureSubgraph(data: SubgraphCreation, organization: string): Promise<Graph> {
    const { name } = data;
    let serviceGraph = await ServiceGraphSchema.findOne({
      organization,
      service: 'SMART_INFRASTRUCTURE',
      type: GraphType.SERVICE
    }).lean();
    if (!serviceGraph) {
      serviceGraph = await this.graphInitializationService.addService('SMART_INFRASTRUCTURE', organization, GraphType.ORGANIZATION);
    }

    const subGraph = await this.createSubgraph(data, serviceGraph._id, GraphSubType.INFRASTRUCTURE, organization);
    const subgraphGraphNode = this.createSubgraphNode(name, subGraph, serviceGraph);
    return await GraphSchema.findByIdAndUpdate(serviceGraph._id, { $push: { subgraphNodes: subgraphGraphNode } });
  }


  async createFloorSubgraph(data: SubgraphCreation, organization: string): Promise<Graph> {
    const { name, infrastructure } = data;
    let infrastructureGraph = await GraphSchema.findOne({
      organization,
      subType: GraphSubType.INFRASTRUCTURE,
      type: GraphType.SUBGRAPH,
      reference: infrastructure
    }).lean();
    if (!infrastructureGraph) {
      infrastructureGraph = await this.createInfrastructureSubgraph(data, organization);
    }

    const subGraph = await this.createSubgraph(data, infrastructureGraph._id, GraphSubType.FLOOR, organization);
    const subgraphGraphNode = this.createSubgraphNode(name, subGraph, infrastructureGraph);
    return await GraphSchema.findByIdAndUpdate(infrastructureGraph._id, { $push: { subgraphNodes: subgraphGraphNode } });
  }

  async createSubgraphByRef(data: SubgraphCreationByRef, organization: string): Promise<Graph> {
    const { name, reference, parentReference, subType } = data;
    const parentGraph = await GraphSchema.findOne({
      organization,
      type: GraphType.SUBGRAPH,
      reference: parentReference
    }).lean();
    if (!parentGraph) {
      throw new Error('No graph with such reference.');
    }

    const subGraph = await this.createSubgraph(data, parentGraph._id, subType, organization);
    const subgraphGraphNode = this.createSubgraphNode(name, subGraph, parentGraph);
    return await GraphSchema.findByIdAndUpdate(parentGraph._id, { $push: { subgraphNodes: subgraphGraphNode } });
  }

  async addStationToFloor(data: { infrastructureId: string, floorId: string, stationId: string, name: string }, organization: string): Promise<any> {
    const { infrastructureId, floorId, stationId, name } = data;
    const infrastructureGraph = await this.findByReference(infrastructureId, GraphSubType.INFRASTRUCTURE);
    const floorGraph = await this.findByReference(floorId, GraphSubType.FLOOR);
    return await this.moveStationToSubGraph(infrastructureGraph, floorGraph, stationId, name, organization);
  }

  async removeStationFromFloor(data: { infrastructureId: string, floorId: string, stationId: string, name: string }, organization: string): Promise<any> {
    const { infrastructureId, floorId, stationId, name } = data;
    const infrastructureGraph = await this.findByReference(infrastructureId, GraphSubType.INFRASTRUCTURE);
    const floorGraph = await this.findByReference(floorId, GraphSubType.FLOOR);
    return await this.moveStationToSubGraph(floorGraph, infrastructureGraph, stationId, name, organization);
  }

  async removeStationSubGraph(stationId: string): Promise<void> {
    await this.removeSubGraphByReference(stationId, GraphSubType.STATION);
  }

  async removeFloorSubGraph(floorId: string): Promise<void> {
    await this.removeSubGraphByReference(floorId, GraphSubType.FLOOR);
  }

  async removeInfrastructureSubGraph(infrastructureId: string): Promise<void> {
    await this.removeSubGraphByReference(infrastructureId, GraphSubType.INFRASTRUCTURE);
  }

  async removeSubGraphByReference(reference: string, type: GraphSubType): Promise<void> {
    const graph = await this.findByReference(reference, type);
    if (!graph) return;
    this.stopSubGraph(graph._id);
    await GraphSchema.update({ 'subgraphNodes.graph': graph._id }, { $pull: { subgraphNodes: { graph: graph._id } } });
    await GraphSchema.findByIdAndRemove(graph._id);
  }

  async moveStationToSubGraph(graphFrom: Graph, graphTo: Graph, stationId: string, name: string, organization: string) {
    const stationGraph = await GraphSchema.findOne({
      organization,
      subType: GraphSubType.STATION,
      type: GraphType.SUBGRAPH,
      reference: stationId
    }).lean();
    let subgraphGraphNode = graphFrom.subgraphNodes.find((gNode: SubgraphGraphNode) => gNode.graph.toString() === stationGraph._id.toString());
    await this.update(stationGraph._id, { parent: graphTo._id });
    await this.update(graphFrom._id, { $pull: { subgraphNodes: { graph: stationGraph._id } } });

    if (!subgraphGraphNode) {
      subgraphGraphNode = this.createSubgraphNode(name, stationGraph, graphTo);
    }
    return await GraphSchema.findByIdAndUpdate(graphTo._id, { $push: { subgraphNodes: subgraphGraphNode } });
  }

  async addDeviceToSubgraph(data: DevicesToSubgraph, organization: string): Promise<Graph> {
    const { device, reference } = data;
    let deviceGraphNode: FunctionalGraphNode;

    const graph = await GraphSchema.findOne({
      organization,
      type: GraphType.SUBGRAPH,
      reference
    }).lean() as Graph;

    const existingGraph = await GraphSchema.findOne({ 'graphNodes.device': device._id }).populate('graphNodes.node');

    if (existingGraph && existingGraph._id.toString() === graph._id.toString()) return;

    if (existingGraph && existingGraph._id.toString() !== graph._id.toString()) {
      deviceGraphNode = existingGraph.graphNodes.find((gNode: FunctionalGraphNode) => gNode.device && gNode.device.toString() === device._id.toString() && gNode.node.type === NodeType.DEVICE_NODE);
    }

    if (deviceGraphNode) {
      await this.update(existingGraph._id, { $pull: { graphNodes: { _id: deviceGraphNode._id } } });
      this.stopGraphNode(organization, deviceGraphNode._id, false);
    } else {
      const node = await this.createFunctionalNode({
        name: device.name,
        inputs: [],
        outputs: [],
        type: NodeType.DEVICE_NODE
      });
      deviceGraphNode = this.createDeviceGraphNode(device, node, graph);
    }

    return await GraphSchema.findByIdAndUpdate(graph._id, { $push: { graphNodes: deviceGraphNode } }, { new: true });
  }

  async addControllerToSubgraph(data: ControllerToSubgraph, organization: string): Promise<Graph> {
    const { devices, reference, controller } = data;

    const graph = await GraphSchema.findOne({
      organization,
      type: GraphType.SUBGRAPH,
      reference
    }).lean() as Graph;
    let graphNode: SubgraphGraphNode;
    const existingGraph = await GraphSchema.findOne({ reference: controller._id }).lean() as Graph;
    if (!existingGraph) {
      const newSubGraph = await this.createControllerSubgraph(controller, organization, graph._id, devices);
      graphNode = await this.createSubgraphNode(controller.name, newSubGraph, graph);
    } else {
      const parentGraph = await GraphSchema.findOne({ 'subgraphNodes.graph': existingGraph._id }).lean() as Graph;
      graphNode = parentGraph.subgraphNodes.find((sG: SubgraphGraphNode) =>  sG.graph._id.toString() === existingGraph._id.toString());
      await this.update(parentGraph._id, { $pull: { subgraphNodes: { graph: existingGraph._id } } });
      await this.update(existingGraph._id, { parent: graph._id });
    }

    return await GraphSchema.findByIdAndUpdate(graph._id, { $push: { subgraphNodes: graphNode } }, { new: true });
  }

  async createControllerSubgraph(controller: Device, organization: string, parentId: string, devices: Device[] = []): Promise<Graph> {
    devices = [controller, ...devices];
    const graphNodes = await Promise.all(
      devices.map( async(device: Device) => {
      const node = await this.createFunctionalNode({
        name: device.name,
        inputs: [],
        outputs: [],
        type: NodeType.DEVICE_NODE
      });
      return this.createDeviceGraphNode(device, node);
    }));

    const subgraph = {
      name: controller.name,
      type: GraphType.SUBGRAPH,
      subType: GraphSubType.CONTROLLER,
      organization,
      parent: parentId,
      reference: controller._id,
      runtime: Runtime.AOS_CLOUD,
      graphNodes,
      subgraphNodes: [],
      connections: [],
      inputs: [],
      outputs: [],
      status: GraphStatus.SAVED,
      core: false
    } as Graph;

    return GraphSchema.create(subgraph);
  }

  async removeControllerFromStation(data: DevicesFromStation, organization: string): Promise<Graph> {
    const { stationId, infrastructureId, controllerId } = data;
    const stationSubGraph = await GraphSchema.findOne({
      organization,
      subType: GraphSubType.STATION,
      type: GraphType.SUBGRAPH,
      reference: stationId
    }).populate('subgraphNodes.graph').lean() as Graph;
    const graphNode = stationSubGraph.subgraphNodes.find((sG: SubgraphGraphNode) => sG.graph && sG.graph.reference && sG.graph.reference.toString() === controllerId);
    await this.update(stationSubGraph._id, { $pull: { subgraphNodes: { _id: graphNode._id } } });
    const infraGraph = await GraphSchema.findOne({
      organization,
      subType: GraphSubType.INFRASTRUCTURE,
      type: GraphType.SUBGRAPH,
      reference: infrastructureId
    }).lean();
    await this.update(graphNode.graph._id, { parent: infraGraph._id });
    return await this.update(infraGraph._id, { $push: { subgraphNodes: graphNode } });
  }

  async removeControllerFromOrg(data: ControllerFromOrg, organization: string): Promise<Graph> {
    const { controllerId, reference } = data;
    const subGraph = await GraphSchema.findOne({
      organization,
      type: GraphType.SUBGRAPH,
      reference: reference
    }).populate('subgraphNodes.graph').lean() as Graph;
    const graphNode = subGraph.subgraphNodes.find((sG: SubgraphGraphNode) => sG.graph && sG.graph.reference && sG.graph.reference.toString() === controllerId);
    await GraphSchema.findByIdAndRemove(graphNode.graph._id);
    return await this.update(subGraph._id, { $pull: { subgraphNodes: { _id: graphNode._id } } });
  }

  async addDriverToController(device: Device, projectId: string, organization: string, reference: string) {
    const queryParam = { 'graphNodes.device': device._id } as any;
    if (reference) {
      queryParam.reference = reference;
    }
    const parentGraph = await GraphSchema.findOne(queryParam).populate('graphNodes.node').lean() as Graph;
    const graphNode = parentGraph.graphNodes.find((gNode: FunctionalGraphNode) => {
      return ( gNode.device && (gNode.device.toString() === device._id.toString()) && gNode.node && gNode.node.type === NodeType.DEVICE_NODE);
    });
    const node = await FunctionalNodeSchema.findByIdAndUpdate(graphNode.node._id, { type: 'USER_NODE', project: projectId }, { new: true }).lean();
    const release = await this.broker.call(this.creatorsStudioServerServiceId + '.ReleasesService.getLatestReleaseByProjectId', { projectId: projectId });
    const parameters = [{ _id: new ObjectId(), name: 'DeviceService.deviceId', value: device._id, mandatory: false }];
    await GraphSchema.findOneAndUpdate({ _id: parentGraph._id, 'graphNodes._id': graphNode._id }, { $set: { 'graphNodes.$.release': release, 'graphNodes.$.instanceVariables.settings.parameters': parameters }}).lean();
    const dataLinkNodeToDevice = { devices: [{ _id: device._id, graphNodes: [{ _id: graphNode._id }]}]};
    this.broker.emit('DevicesService.linkGraphNodes', dataLinkNodeToDevice, 'DEVICE_MANAGER');
    await this.publishGraphNode(graphNode._id.toString(), organization, false);
  }

  async removeDriverFromController(device: Device, organization: string, reference: string) {
    const queryParam = { 'graphNodes.device': device._id } as any;
    if (reference) {
      queryParam.reference = reference;
    }
    const parentGraph = await GraphSchema.findOne(queryParam).populate(DEFAULT_PROJECT_NODE_POPULATION).lean() as Graph;
    const graphNode = parentGraph.graphNodes.find((gNode: FunctionalGraphNode) => {
      return ( gNode.device && (gNode.device.toString() === device._id.toString()) && gNode.node && gNode.node.project && gNode.node.project.projectType === ProjectType.DEVICE_NODE);
    });
    this.stopGraphNode(organization, graphNode._id, false);
    // tslint:disable-next-line:no-null-keyword
    const node = await FunctionalNodeSchema.findByIdAndUpdate(graphNode.node._id, { $set: { type: 'DEVICE_NODE', project: null } }, { new: true }).lean();
    // tslint:disable-next-line:no-null-keyword
    await GraphSchema.findOneAndUpdate({ _id: parentGraph._id, 'graphNodes._id': graphNode._id }, { $set: { 'graphNodes.$.release': null, 'graphNodes.$.instanceVariables.settings.parameters': [] }}).lean();
  }

  // Temporary solution for demo
  async createFunctionalNode(payload: { name: string, inputs: SocketMetadata[], outputs: SocketMetadata[], type: NodeType }) {
    const node = {
      inputs: payload.inputs,
      outputs: payload.outputs,
      name: payload.name,
      type: payload.type,
      description: payload.name,
      runtime: Runtime.AOS_CLOUD
    } as Node;
    return await FunctionalNodeSchema.create(node);
  }

  async createStationSubgraph(data: SubgraphCreation, organization: string): Promise<Graph> {
    const { name, infrastructure } = data;
    const infrastructureGraph = await GraphSchema.findOne({
      organization,
      subType: GraphSubType.INFRASTRUCTURE,
      type: GraphType.SUBGRAPH,
      reference: infrastructure
    }).lean();
    const subGraph = await this.createSubgraph(data, infrastructureGraph._id, GraphSubType.STATION, organization);
    const subgraphGraphNode = this.createSubgraphNode(name, subGraph, infrastructureGraph);
    return await GraphSchema.findByIdAndUpdate(infrastructureGraph._id, { $push: { subgraphNodes: subgraphGraphNode } });
  }

  async updateUIElements(data: UpdateUIElements): Promise<Graph> {
    const { graphNodeId, uiElements } = data;
    return await GraphSchema.findOneAndUpdate({ 'graphNodes._id': graphNodeId }, { $set: { 'graphNodes.$.uiElements': uiElements }}).lean();
  }

  async createSubgraph(data: { name: string, reference: string, controller?: any, service?: SpecialServiceType}, parentId: string, subType: string, organization: string): Promise<Graph> {
    const { name, reference, controller, service } = data;
    const _id = new ObjectId();
    const subgraph = {
      name,
      type: GraphType.SUBGRAPH,
      subType,
      organization,
      parent: parentId,
      reference,
      runtime: Runtime.AOS_CLOUD,
      graphNodes: [],
      informationNodes: [],
      subgraphNodes: [],
      connections: [],
      inputs: [],
      outputs: [],
      status: GraphStatus.SAVED,
      core: false,
      _id
    } as any as Graph;

    if (subType === GraphSubType.STATION && controller) {
      let graphNode: SubgraphGraphNode;
      const existingGraph = await GraphSchema.findOne({ reference: controller._id }).lean() as Graph;

      if (!existingGraph) {
        const newSubGraph = await this.createControllerSubgraph(controller, organization, subgraph._id, []);
        graphNode = await this.createSubgraphNode(controller.name, newSubGraph, subgraph);
        subgraph.subgraphNodes = [...subgraph.subgraphNodes, graphNode];
      } else {
        const parentGraph = await GraphSchema.findOne({ 'subgraphNodes.graph': existingGraph._id }).lean() as Graph;
        graphNode = parentGraph.subgraphNodes.find((sG: SubgraphGraphNode) => sG.graph._id.toString() === existingGraph._id.toString());
        await this.update(parentGraph._id, { $pull: { subgraphNodes: { graph: existingGraph._id } } });
        await this.update(existingGraph._id, { parent: subgraph._id });
        subgraph.subgraphNodes = [...subgraph.subgraphNodes, graphNode];
      }
    }

    if (subType === GraphSubType.SPECIAL) {
      (subgraph as any).service = service;
      const node = await ServiceNodeSchema.findOne({ service }).lean() as ServiceNode;
      const specialGraphNode = this.createSpecialGraphNode(reference, name, node._id, service);
      subgraph.graphNodes.push(specialGraphNode);
    }

    return GraphSchema.create(subgraph);
  }

  createDeviceGraphNode(controller: Device, node: Node, graph?: Graph) {
    const uniqueName = graph ? this.sharedService.getUniqueName(graph, controller.name) : controller.name;
    return {
      node: node._id,
      graphNodeName: uniqueName,
      position: [],
      device: controller._id,
      status: GraphNodeStatus.CREATED
    } as unknown as FunctionalGraphNode;
  }

  createSpecialGraphNode(reference: string, name: string, nodeId: string, service: SpecialServiceType) {
    const specialGraphNode = {
      node: nodeId,
      graphNodeName: name,
      position: [],
      status: GraphNodeStatus.CREATED,
      isServiceSpecific: true
    } as FunctionalGraphNode;

    switch (service) {
      case SpecialServiceType.PROJECT_MANAGER:
        specialGraphNode.project = reference;
        break;
      case SpecialServiceType.JOB_SITE:
        specialGraphNode.jobSiteProject = reference;
        break;
      case SpecialServiceType.SMART_INFRASTRUCTURE:
        // specialGraphNode.infrastructure = reference;
        break;
    }

    return specialGraphNode;
  }

  createSubgraphNode(name: string, graph: Graph, parentGraph: Graph): SubgraphGraphNode {
    const uniqueName = this.sharedService.getUniqueName(parentGraph, name);
    const subGraphNode = new SubgraphGraphNode();
    subGraphNode.graphNodeName = uniqueName;
    subGraphNode.position = [];
    subGraphNode.graph = graph._id;
    return subGraphNode;
  }

  async createSpecialSubgraph(data: SpecialSubgraphCreation, organization: string): Promise<Graph> {
    const { name, service } = data;
    let serviceGraph = await ServiceGraphSchema.findOne({
      organization,
      service,
      type: GraphType.SERVICE
    }).lean();
    if (!serviceGraph) {
      serviceGraph = await this.graphInitializationService.addService(service, organization, GraphType.ORGANIZATION);
    }

    const subGraph = await this.createSubgraph(data, serviceGraph._id, GraphSubType.SPECIAL, organization);
    const subgraphGraphNode = this.createSubgraphNode(name, subGraph, serviceGraph);
    return await GraphSchema.findByIdAndUpdate(serviceGraph._id, { $push: { subgraphNodes: subgraphGraphNode } });
  }

  async getSubgraphByRef(reference: string) {
    return GraphSchema.findOne({ reference }).lean();
  }

  async getGraphOrgApplications(organization: string, withBreadcrumbs: boolean = false) {
    let graphs = await GraphSchema.find({ organization }).lean() as Graph[];
    const allGraphNodes = [] as any[];

    if (withBreadcrumbs) {
      graphs = await Promise.all(graphs.map(async (graph: Graph) => {
        const breadcrumbs = (await this.getBreadcrumbs(graph._id))[0];
        if (breadcrumbs) {
          const hierarchy = breadcrumbs.graphHierarchy.slice(1);
          graph.breadcrumbs = hierarchy.map((h: any) => h.name);
        }
        return graph;
      }));
    }

    graphs.forEach((graph: Graph) => {
      if (graph.graphNodes && graph.graphNodes.length) {
        const nodes = graph.graphNodes.map(gN => {
          return {
            ...gN,
            parentGraph: _.pick(graph, ['_id', 'name', 'type', 'status']),
            breadcrumbs: graph.breadcrumbs
          };
        });
        allGraphNodes.push(...nodes);
      }
    });

    const parsedGraphNodes = await this.getParsedApplicationsFromGraphNodes(allGraphNodes, true, true);
    const applications = parsedGraphNodes.filter((graphNode: any) => graphNode ?.release ?.project ?.projectType || graphNode ?.node ?.project ?.projectType)
      .map((graphNode: any) => ({
        isLatest: graphNode ?.isLatest,
        graphNodeId: graphNode._id,
        graphNodeName: graphNode ?.graphNodeName,
        parentGraph: graphNode ?.parentGraph,
        breadcrumbs: graphNode ?.breadcrumbs,
        device: graphNode ?.device,
        status: graphNode ?.status,
        version: graphNode ?.release ?.tag || undefined,
        uiElements: graphNode.uiElements || [],
        project: typeof graphNode ?.node ?.project === 'object' ? graphNode ?.node ?.project : graphNode.release.project
    }));

    return applications;
  }

  async getSubgraphByQuery(referenceType: GraphRefType, reference: string, organization: string) {
    if (referenceType !== GraphRefType.SERVICE) {
      return await this.getSubgraphByRef(reference);
    }

    // In Users service applications add to Org level graph
    if (reference === 'USERS') {
      return await this.findOrgGraph(organization);
    }

    return GraphSchema.findOne({ type: GraphType.SERVICE, service: reference, organization }).lean();
  }

  // temporary solution
  async addNodesToSubgraphByRef(subGraph: IGraph, nodes: IFunctionalNode[], deviceId: string) {
    return Promise.all(
      nodes.map(async n => {
        const release = await this.broker.call(this.creatorsStudioServerServiceId + '.ReleasesService.getLatestReleaseByProjectId', { projectId: n.project._id });
        return this.addNodeToSubgraph(subGraph, n, release, deviceId);
      })
    );
  }

  // temporary solution
  async addNodeToSubgraphByRef(subGraph: IGraph, node: FunctionalNode) {
    const release = await this.broker.call(this.creatorsStudioServerServiceId + '.ReleasesService.getLatestReleaseByProjectId', { projectId: node.project._id });
    return this.addNodeToSubgraph(subGraph, node, release, undefined);
  }

  async addNodeToSubgraph(subGraph: IGraph, node: FunctionalNode, release: Release, deviceId: string) {
    const uniqueName = this.sharedService.getUniqueName(subGraph, node.project.name);
    const graphNode = {
      graphNodeName: uniqueName,
      node: node._id,
      position: [],
      release,
      _id: new ObjectId()
    } as any;
    if (deviceId) {
      graphNode.device = deviceId;
    }
    await GraphSchema.update({ _id: subGraph._id }, { $push: { graphNodes: graphNode } });

    return graphNode;
  }

  async update(graphId: string, graph: any, populate?: boolean): Promise<Graph> {

    // making sure that status is not updated
    if (graph.graphNodes?.length) {
      const existingGraph = await this.findById(graphId);
      const graphNodeLength = existingGraph.graphNodes.length;
      for (let i = 0; i < graphNodeLength; i++) {
        const index = graph.graphNodes.findIndex((g: any) => g._id === existingGraph.graphNodes[i]._id.toString());
        if (index === -1) {
          continue;
        }
        graph.graphNodes[index].status = existingGraph.graphNodes[i].status;
      }
    }

    if (populate) {
      if (this.isServiceGraph(graph)) {
        const updatedGraph = await ServiceGraphSchema.findByIdAndUpdate(graphId, graph, { new: true })
          .populate('graphNodes.device', '-ssh')
          .populate(DEFAULT_PROJECT_NODE_POPULATION)
          .populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections')
          .populate('serviceGraphNode.node')
          .populate('serviceGraphNode.node');
        return updatedGraph;
      }
      const updatedGraph = await GraphSchema.findByIdAndUpdate(graphId, graph, { new: true })
        .populate('graphNodes.node', '-templateVariables')
        .populate('graphNodes.device', '-ssh')
        .populate(DEFAULT_PROJECT_NODE_POPULATION)
        .populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections');
      return updatedGraph;
    }
    if (this.isServiceGraph(graph)) {
      return await ServiceGraphSchema.findByIdAndUpdate(graphId, graph, { new: true });
    }
    return await GraphSchema.findByIdAndUpdate(graphId, graph, { new: true });
  }

  async remove(graphIds: string[]): Promise<any> {
    return GraphSchema.remove({ '_id': { $in: graphIds } });
  }

  async removeApplication(graphNodeId: string, organization: string): Promise<Graph> {
    await this.stopGraphNode(graphNodeId, organization, false);
    return await GraphSchema.findOneAndUpdate({ organization, 'graphNodes._id': graphNodeId }, { $pull: { graphNodes: { _id: new ObjectId(graphNodeId) } }}).lean();
  }

  async removeDevice(data: RemoveDevice, organization: string): Promise<Graph> {
    const { device, reference, subType, infrastructure } = data;
    const graph = await this.findByReference(reference, subType);
    const graphNode = graph.graphNodes.find((gNode: FunctionalGraphNode) => {
      return ( gNode.device && (gNode.device.toString() === device));
    });

    const result = await GraphSchema.findByIdAndUpdate(graph._id, { $pull: { graphNodes: { _id: graphNode._id } }}).lean();
    this.stopGraphNode(organization, graphNode._id, false);
    if (subType === GraphSubType.INFRASTRUCTURE || subType === GraphSubType.CONTROLLER) {
      await FunctionalNodeSchema.findByIdAndRemove(graphNode.node);
    } else if (infrastructure) {
      await GraphSchema.findOneAndUpdate({ reference: infrastructure, subType: GraphSubType.INFRASTRUCTURE }, { $push: { graphNodes: graphNode } }).lean();
    }
    return result;
  }

  async disableServiceGraph(serviceId: string, organization: string, core: boolean): Promise<any> {
    logger.info('[disableServiceGraph]', serviceId, organization, core);
    // OLD logic for dividing SI to 3 subgraphs
    // if (serviceId === 'SMART_INFRASTRUCTURE') {
    //   const smartServices = Object.keys(InfrastructureType);
    //   return smartServices.forEach(async s => {
    //     await this.disableServiceGraph(s, organization, core);
    //   });
    // }

    return await ServiceGraphSchema.findOneAndUpdate({
      service: serviceId,
      organization,
      core
    }, { disabled: true }, { new: true });
  }

  async getGraphLogs(graphId: string, from?: number, size?: number, graphNodeId?: string): Promise<any> {
    const query = {} as any;
    query.graphId = graphId;
    if (from) {
      query.from = from;
    }
    if (size) {
      query.size = size;
    }
    if (graphNodeId) {
      query.graphNodeId = graphNodeId;
    }
    return await this.broker.call(`${this.buildServerServiceId}.GraphsService.getLogs`, query);
  }

  async getBreadcrumbs(graphId: string): Promise<any> {
    const aggregation = [
      {
        $match: { _id: new ObjectId(graphId) }
      },
      {
        $graphLookup: {
          from: 'system_graph__graphs',
          startWith: '$parent',
          connectFromField: 'parent',
          connectToField: '_id',
          as: 'graphHierarchy',
          depthField: 'depth'
        }
      },
      {
        $project: {
          'graphHierarchy._id': 1,
          'graphHierarchy.name': 1,
          'graphHierarchy.type': 1,
          'graphHierarchy.subType': 1,
          'graphHierarchy.service': 1,
          'graphHierarchy.depth': 1,
          'graphHierarchy.parent': 1,
        }
      },
      { $unwind: '$graphHierarchy' },
      { $sort : { 'graphHierarchy.depth' : -1 } },
      { $group: {
        _id: '$_id',
        graphHierarchy: {
          $push: '$graphHierarchy'
        }
    }}
    ];

    return await GraphSchema.aggregate(aggregation);
  }


  private isServiceGraph(graph: Graph): graph is ServiceGraph {
    return (graph as ServiceGraph).serviceGraphNode !== undefined
      && (graph as ServiceGraph).service !== undefined;
  }


  async processGeneratingGraph(graph: Graph | ServiceGraph, checkLatestReleaseNodes: boolean, getStyledNodes: boolean = false, addSubgraphStatuses: boolean = false): Promise<Graph | ServiceGraph> {

    if (checkLatestReleaseNodes) {
      graph.graphNodes = await this.checkLatestReleaseNodes(graph.graphNodes);
    }

    if (getStyledNodes) {
      graph.graphNodes = await this.getStyledNodes(graph.graphNodes);
    }

    if (addSubgraphStatuses) {
      graph.subgraphNodes = await this.addSubgraphStatuses(graph.subgraphNodes);
    }

    return graph;
  }


  /**
   * Check if latest node on compiled graph
   *
   * @param graphNodes
   */
  async checkLatestReleaseNodes(graphNodes: FunctionalGraphNode[]) {
    return Promise.all(graphNodes.map(async (graphNode: any) => {
      const isLatest = await this.checkIfGraphNodeHasLatestRelease(graphNode);
      return {
        ...graphNode,
        isLatest
      };
    }));
  }

  async getStyledNodes(graphNodes: FunctionalGraphNode[]) {
    return Promise.all(graphNodes.map(async (graphNode: any) => {
      const node = graphNode.node as FunctionalNode;
      let storeRequest;
      if (node.type === NodeType.TEMPLATE_NODE) {
        const request = await this.broker.call<any>('MARKETPLACE.StoreRequestsService.findByNodeAction', { provisionalNode: node._id });
        if (request) {
          storeRequest = request;
        }
      } else if (node.project) {
        const request = await this.broker.call<any>('MARKETPLACE.StoreRequestsService.findByProjectAction', { project: node.project._id });
        if (request) {
          storeRequest = request;
        }
      }
      if (storeRequest) {
        graphNode.node.storeRequest = {
          _id: storeRequest._id,
          nodeStyling: storeRequest.final && storeRequest.final.nodeStyling
            ? storeRequest.final.nodeStyling
            : (storeRequest.initial ? storeRequest.initial.nodeStyling : {}),
        };
      } else {
        graphNode.node.storeRequest = {};
      }
      return graphNode;
    }));
  }

  async addSubgraphStatuses(subGraphNodes: SubgraphGraphNode[]): Promise<SubgraphGraphNode[]> {
    return Promise.all(subGraphNodes.map(async (subGraphNode: SubgraphGraphNode) => {
      const graphId = subGraphNode.graph._id || subGraphNode.graph;
      const graph = await GraphSchema.findById(graphId).lean();
      const childHierarchy = [graph] as Graph[];
      await this.applyChildGraphHierarchyMut(graphId, childHierarchy);
      const statuses: { [key: string]: number } = Object.keys(SubgraphNodeStatuses.SubgraphNodeStatusEnum).reduce((acc: { [key: string]: number }, s: string) => {
        return { ...acc, [s]: 0 };
      }, {});

      if (childHierarchy.length) {
        await this.applyStatusesMut(statuses, childHierarchy);
      }
      subGraphNode.statuses = statuses;

      return subGraphNode;
    }));
  }

  async applyStatusesMut(statuses: { [key: string]: number }, childHierarchy: Graph[]): Promise<any> {
    childHierarchy.forEach(({ graphNodes = [], subgraphNodes = [], informationNodes = [], serviceGraphNode}: ServiceGraph | Graph | any, i: number) => {

      if (
        !graphNodes.length
        && !subgraphNodes.length
        && !informationNodes.length
        && !serviceGraphNode
      ) {
        // If first graph has no items, status must be just empty
        if (!i) {
          return;
        }
        return statuses[SubgraphNodeStatuses.SubgraphNodeStatusEnum.EMPTY]++;
      }

      if (serviceGraphNode) {
        statuses[SubgraphNodeStatuses.SubgraphNodeStatusEnum.RUNNING]++;
      }

      graphNodes.forEach((graphNode: FunctionalGraphNode) => {
        switch (graphNode.status) {
          case GraphNodeStatus.RUNNING:
          case GraphNodeStatus.RUNNING_ANOTHER_RELEASE:
            statuses[SubgraphNodeStatuses.SubgraphNodeStatusEnum.RUNNING]++;
            break;
          case GraphNodeStatus.ERROR:
            statuses[SubgraphNodeStatuses.SubgraphNodeStatusEnum.ERROR]++;
            break;
          case GraphNodeStatus.TERMINATED:
          case GraphNodeStatus.SAVED:
          case GraphNodeStatus.CREATED:
            statuses[SubgraphNodeStatuses.SubgraphNodeStatusEnum.STOPPED]++;
            break;
          case GraphNodeStatus.PENDING:
            statuses[SubgraphNodeStatuses.SubgraphNodeStatusEnum.PENDING]++;
            break;
        }
      });

      if (informationNodes.length) {
        statuses[SubgraphNodeStatuses.SubgraphNodeStatusEnum.INFO] += informationNodes.length;
      }

    });
  }

  async applyChildGraphHierarchyMut(graphId: string, graphs: Graph[]): Promise<any> {
    const children = await GraphSchema.find({ parent: graphId }).lean();
    if (!children.length) return;
    graphs.push(...children);
    return await Promise.all(children.map(async (graphElem: Graph) => {
      return await this.applyChildGraphHierarchyMut(graphElem._id, graphs);
    }));
  }


  async processCreatedSubGraphs(graph: Graph) {
    return Promise.all(graph.subgraphNodes.map(async (graphNode: SubgraphGraphNode) => {

      if (graphNode.status !== GraphNodeStatus.CREATED) return graphNode;

      const templateGraph = await GraphSchema.findById(graphNode.graph).lean();

      const newGraphId = new ObjectID().toString();

      const savedGraphNodes = this.getSavedGraphNodes(templateGraph.graphNodes, []);

      const savedConnections = this.getSavedConnections(templateGraph.connections, savedGraphNodes, newGraphId);

      const newGraph = {
        _id: newGraphId,
        ref: templateGraph._id,
        parent: graph._id,
        name: graphNode.graphNodeName,
        organization: templateGraph.organization,
        type: GraphType.LINKED,
        runtime: templateGraph.runtime,
        graphNodes: savedGraphNodes,
        subgraphNodes: [],
        connections: savedConnections,
        inputs: templateGraph.inputs,
        outputs: templateGraph.outputs
      } as LinkedGraph;

      const savedSubGraphRes = await LinkedGraphSchema.create(newGraph);
      const savedSubGraph = savedSubGraphRes.toObject();
      graphNode.graph = savedSubGraph._id;
      return graphNode;
    }));
  }

  async updateLinkedGraphs(templateGraphId: string): Promise<LinkedGraph[]> {
    const linkedGraphs = await LinkedGraphSchema.find({ ref: templateGraphId, type: GraphType.LINKED });
    const updatedLinkedGraphs = await Promise.all(linkedGraphs.map(async (linkedGraph: LinkedGraph) => {
      return await this.processLinkedGraphUpdating(linkedGraph, templateGraphId);
    }));

    return updatedLinkedGraphs;
  }

  async processLinkedGraphUpdating(linkedGraph: LinkedGraph, templateGraphId: string) {
    const templateGraph = await GraphSchema.findById(templateGraphId).lean();
    const savedGraphNodes = this.getSavedGraphNodes(templateGraph.graphNodes, linkedGraph.graphNodes);

    const savedConnections = this.getSavedConnections(templateGraph.connections, savedGraphNodes, templateGraph._id);

    const updateData = {
      runtime: templateGraph.runtime,
      graphNodes: savedGraphNodes,
      connections: savedConnections,
      inputs: templateGraph.inputs,
      outputs: templateGraph.outputs
    } as LinkedGraph;

    const updatedLinkedGraph = await LinkedGraphSchema.findByIdAndUpdate(linkedGraph._id, updateData, { new: true });
    return updatedLinkedGraph;
  }

  getSavedGraphNodes(templateGraphNodes: FunctionalGraphNode[], linkedGraphNodes: FunctionalGraphNode[]) {
    return templateGraphNodes.map((graphNode: FunctionalGraphNode) => {
      const linkedNode = linkedGraphNodes.find((node: FunctionalGraphNode) => node.ref.toString() === graphNode._id.toString());
      const newGraphBodeId = linkedNode ? linkedNode._id : new ObjectID().toString();
      return {
        ...graphNode,
        _id: newGraphBodeId,
        ref: graphNode._id
      };
    });
  }

  getSavedConnections(connections: GraphConnection[], savedGraphNodes: GraphNode[], newGraphId: string) {
    return connections.map((connection: GraphConnection) => {
      const source = this.getSavedJunction(connection.source, savedGraphNodes, newGraphId);
      const target = this.getSavedJunction(connection.target, savedGraphNodes, newGraphId);
      const result = {
        ...connection,
        source,
        target
      };
      return result;
    });
  }

  getSavedJunction(point: SocketJunctionPoint, savedGraphNodes: GraphNode[], newGraphId: string) {
    switch (point.type) {
      case ConnectionType.NODE:
        const graphNode = savedGraphNodes.find(node => node.ref.toString() === point.graphNodeId.toString());
        point.graphNodeId = graphNode._id;
        break;
      case ConnectionType.INTERFACE:
        point.graphNodeId = newGraphId;
        break;
      case ConnectionType.SUBGRAPH:
        // TO_DO After subgraph in subgraph template
        // point.graphNodeId = newGraphId;
        break;
    }
    return point;
  }

  async publishGraphNode(graphNodeId: string, organization: string, updateToLatestRelease: boolean) {
    const generatedGraphNode = await this.flattenGraphService.generateFlattenGraphNode(graphNodeId, updateToLatestRelease);
    await this.sendPublishGraphNode(organization, generatedGraphNode);
  }

  async sendPublishGraphNode(organization: string, graphNode: FlattenGraphNode, connections: GraphConnection[] = []) {
    this.broker.emit('GraphsService.publishGraphNode', { organization, graphNode, connections }, this.buildServerServiceId);
  }

  async stopGraphNode(graphNodeId: string, organization: string, updateToLatestRelease: boolean) {
    const generatedGraphNode = await this.flattenGraphService.generateFlattenGraphNode(graphNodeId, updateToLatestRelease);
    await this.sendStopGraphNode(organization, generatedGraphNode);
  }

  async sendStopGraphNode(organization: string, graphNode: FlattenGraphNode) {
    this.broker.emit('GraphsService.stopGraphNode', { organization, graphNode }, this.buildServerServiceId);
  }

  @Event()
  async initOrganization(payload: { user: any, organization: any }) {
    try {
      const graph = await this.findOrgGraph(payload.organization._id);
      if (graph) {
        // graph already present
        return logger.info('[GraphsService.initOrganization]: Graph already found');
      }
      const organizationGraph = new Graph();
      organizationGraph.organization = payload.organization._id;
      organizationGraph.type = GraphType.ORGANIZATION;
      organizationGraph.name = payload.organization.domain;
      organizationGraph.runtime = Runtime.AOS_CLOUD;
      organizationGraph.createdBy = payload.user._id;
      organizationGraph.graphNodes = [];
      await GraphSchema.create(organizationGraph);
      this.graphInitializationService.initCoreServices(payload.organization._id);
      logger.info('[GraphsService.initOrganization]: Organization graph created', { organization: organizationGraph._id });
    } catch (err) {
      logger.error('[GraphsService.initOrganization]: Error', err);
    }
  }

  @Event()
  async deployGraphNode(payload: { graphNodeId: string, organization: string, publish: boolean, updateToLatestRelease: boolean }) {
    try {
      payload.publish ? await this.publishGraphNode(payload.graphNodeId, payload.organization, payload.updateToLatestRelease) :
                        await this.stopGraphNode(payload.organization, payload.graphNodeId, false);
      logger.info('[GraphsService.deployGraphNode]: ', payload);
    } catch (err) {
      logger.error('[GraphsService.deployGraphNode]: Error', err);
    }
  }

  @Event()
  async initCoreGraph() {
    try {
      // TO_DO Rework hardcoded org id. Must be api from Admin service or Platform support
      const organization = '5b456dc1a8ed350010ce7244';
      const coreGraph = new Graph();
      coreGraph.organization = organization;
      coreGraph.type = GraphType.CORE;
      coreGraph.name = 'Core graph';
      coreGraph.runtime = Runtime.AOS_CLOUD;
      coreGraph.graphNodes = [];
      await GraphSchema.create(coreGraph);
      await this.graphInitializationService.initCoreServices(organization, GraphType.CORE);
      logger.info('[GraphsService.initCoreGraph]: Core graph created');
    } catch (err) {
      logger.error('[GraphsService.initCoreGraph]: Error', err);
    }
  }

  @Event()
  async organizationServiceChange(payload: { service: string, action: 'REMOVED' | 'ADDED', organization: string }) {
    if (payload.action === 'ADDED') {
      await this.graphInitializationService.addService(payload.service, payload.organization, GraphType.ORGANIZATION);
    } else if (payload.action === 'REMOVED') {
      await this.disableServiceGraph(payload.service, payload.organization, false);
    }
    // TO_DO: Figure if its logic needed
    // await this.deployGraph(payload.organization);
  }

  @Event()
  async graphNodeStatus(payload: { graphNodeId: string, status: GraphNodeStatus.PENDING | GraphNodeStatus.TERMINATED | GraphNodeStatus.ERROR | GraphNodeStatus.RUNNING }) {
    try {
      logger.info('[GraphsService.graphNodeStatus]: Node status updated', payload);
      await GraphSchema.updateOne({ graphNodes: { $elemMatch: { _id: new ObjectID(payload.graphNodeId) } } }, { $set: { 'graphNodes.$.status': payload.status } });
      logger.info(`[GraphService.graphNodeStatus] GraphNode Status`, {graphNodeId: payload.graphNodeId, status: payload.status});
      this.broker.emit('AutomationService.graphNodeStatus', {graphNodeId: payload.graphNodeId, status: payload.status}, this.creatorsStudioServerServiceId);

      const graph = await GraphSchema.findOne({ graphNodes: { $elemMatch: { _id: payload.graphNodeId } } }).populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections').lean();

      if (graph.status === GraphStatus.ERROR) return;

      switch (payload.status) {
        case GraphNodeStatus.ERROR:
          await this.setGraphErrorStatus(graph);
          break;
        case GraphNodeStatus.RUNNING:
          await this.setGraphRunningStatus(graph);
          break;
        case GraphNodeStatus.TERMINATED:
          break;
        case GraphNodeStatus.PENDING:
          break;
      }
    } catch (err) {
      logger.error('[GraphsService.graphNodeStatus]: Node status error', err);
    }
  }

  async setGraphErrorStatus(graph: Graph): Promise<any> {
    await GraphSchema.findByIdAndUpdate(graph._id, { status: GraphStatus.ERROR });
    if (!graph.parent) {
      return;
    }
    const parentGraph = await GraphSchema.findById(graph.parent).populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections').lean();
    return await this.setGraphErrorStatus(parentGraph);
  }

  async setGraphRunningStatus(graph: Graph): Promise<any> {
    const notRunningNode = graph.graphNodes.find(node => node.status !== GraphNodeStatus.RUNNING);
    const notRunningGraph = graph.subgraphNodes.find(node => node.graph.status !== GraphStatus.RUNNING);
    if (notRunningNode || notRunningGraph) return;

    await GraphSchema.findByIdAndUpdate(graph._id, { status: GraphStatus.RUNNING });
    if (!graph.parent) {
      return;
    }

    const parentGraph = await GraphSchema.findById(graph.parent).populate('subgraphNodes.graph', '-graphNodes -subgraphNodes -connections').lean();
    return await this.setGraphRunningStatus(parentGraph);
  }

  async toggleCoreServiceSubgraph(coreGraph: Graph, service: string) {
    const serviceSubgraphNode = coreGraph.subgraphNodes.find((subgraphNode: SubgraphGraphNode) => {
      return (subgraphNode.graph.service === service) && !subgraphNode.graph.disabled;
    });

    if (!serviceSubgraphNode) {
      await this.graphInitializationService.addService(service, coreGraph.organization, GraphType.CORE);
    } else {
      await this.disableServiceGraph(service, coreGraph.organization, true);
    }
  }

  async deploySubGraph(graphId: string): Promise<FlattenGraph> {
    const graph = await GraphSchema.findById(graphId).populate(DEFAULT_PROJECT_NODE_POPULATION).populate('serviceGraphNode.node').populate(DEFAULT_DEVICE_POPULATION).lean();
    const flattenSubGraph = await this.flattenGraphService.getFlattenGraph(graph, false);
    await this.serviceDeploymentsService.createServiceDeploymentsFromFlattenGraph(flattenSubGraph);
    await this.flattenGraphService.setGraphStatus(graphId, GraphStatus.PENDING);
    this.broker.emit(`GraphsService.publish`, flattenSubGraph, this.buildServerServiceId);
    return flattenSubGraph;
  }

  async deployGraph(organization: string): Promise<FlattenGraph> {
    const graph = await GraphSchema.findOne({
      organization,
      type: GraphType.ORGANIZATION
    }).populate(DEFAULT_PROJECT_NODE_POPULATION).populate(DEFAULT_DEVICE_POPULATION).lean();

    const flattenGraph = await this.flattenGraphService.getFlattenGraph(graph, true);

    await this.serviceDeploymentsService.createServiceDeploymentsFromFlattenGraph(flattenGraph);
    await this.setOrgGraphsStatus(organization, GraphStatus.PENDING);
    this.broker.emit(`GraphsService.publish`, flattenGraph, this.buildServerServiceId);

    return flattenGraph;
  }

}
