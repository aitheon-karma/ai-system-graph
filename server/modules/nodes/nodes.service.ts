import { Current, logger } from '@aitheon/core-server';
import { Event, Transporter, TransporterService } from '@aitheon/transporter';
import Container, { Service, Inject } from 'typedi';
import { GraphSchema, Graph, GraphType } from '../graph/graph.model';
import { BotSchema, IBot } from '../shared/bots.model';
import { BazelBuild, BazelDepsBuildGenerator } from '../shared/isaac/isaac-bazel-build';
import { FunctionalNode, FunctionalNodeSchema, isFunctionalNode } from './node-functional.model';
import { NodeGroup, NodeGroupSchema, Runtime } from './node-group.model';
import { isServiceNode, ServiceNode, ServiceNodeSchema } from './node-service.model';
import { INode, Node, NodeSchema, NodeType, SocketMetadata } from './node.model';
import { PurchasedAppsApi } from '@aitheon/marketplace-server';
import { Item, ItemApi } from '@aitheon/item-manager-server';
import { Release } from '@aitheon/creators-studio-server';
import { ObjectID } from 'bson';
import { environment } from '../../environment';
import { InfrastructureType } from '../shared/deployment.model';
import { Project, ProjectType } from '../shared/project.model';
import { SharedService, SERVICE_IGNORE_LIST } from '../shared/shared.service';
import { GraphInitializationService } from '../graph/graph-initialization.service';
import { GraphsService } from '../graph/graph.service';

@Service()
@Transporter()
export class NodesService extends TransporterService {

  creatorStudioTransportUri = `CREATORS_STUDIO${environment.production ? '' : '_DEV'}`;

  @Inject(() => GraphsService)
  graphsService: GraphsService;

  purchasedAppsApi: PurchasedAppsApi;
  itemApi: ItemApi;
  private sharedService: SharedService;

  constructor() {
    super(Container.get('TransporterBroker'));
    this.purchasedAppsApi = new PurchasedAppsApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/marketplace`);
    this.itemApi = new ItemApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/item-manager`);
    this.sharedService = Container.get(SharedService);
    this.graphInitializationService = Container.get(GraphInitializationService);
  }

  async generateIsaacBuildById(nodeId: string): Promise<BazelBuild> {
    const node = await NodeSchema.findById(nodeId);
    if (isFunctionalNode(node)) {
      return BazelDepsBuildGenerator.generateBazelComponentBuild(node);
    } else {
      throw new TypeError(`Node ${nodeId} is not isaac-compatible.`);
    }
  }

  async findAll(): Promise<INode[]> {
    return NodeSchema.find({});
  }

  async findAllFunctionalNodes(): Promise<FunctionalNode[]> {
    return FunctionalNodeSchema.find({});
  }

  async findAllServiceNodes(): Promise<ServiceNode[]> {
    return ServiceNodeSchema.find({});
  }

  async findAllGroups(): Promise<NodeGroup[]> {
    return NodeGroupSchema.find({});
  }

  async findById(nodeId: string): Promise<Node> {
    return NodeSchema.findById(nodeId).lean();
  }

  async findByServiceId(service: string): Promise<ServiceNode> {
    return ServiceNodeSchema.findOne({service, type: NodeType.SERVICE_NODE}).lean();
  }

  async findByProjectId(projectId: string): Promise<FunctionalNode> {
    // Add sorting for backward compatibility
    return FunctionalNodeSchema.findOne({project: projectId}, undefined, {sort: {createdAt: -1}});
  }

  async findByProjectIds(projects: string[]) {
    return FunctionalNodeSchema.find({
      project: {$in: projects}
    }).populate('project', '_id name').lean();
  }

  async findGroupById(groupId: string): Promise<NodeGroup> {
    return NodeGroupSchema.findById(groupId);
  }

  async findByGroup(groupId: string): Promise<INode[]> {
    return NodeSchema.find({group: groupId});
  }

  async create(node: any): Promise<INode> {
    if (isFunctionalNode(node)) {
      return await FunctionalNodeSchema.create(node);
    }
    if (isServiceNode(node)) {
      return await ServiceNodeSchema.create(node);
    }
    if (node.type === NodeType.DEVICE_NODE) {
      return await NodeSchema.create(node);
    }
    throw new TypeError('Node is invalid. It must be FunctionalNode or ServiceNode.');
  }

  async createGroup(nodeGroup: NodeGroup): Promise<NodeGroup> {
    return await NodeGroupSchema.create(nodeGroup);
  }

  async update(nodeId: string, node: Node): Promise<INode> {
    const existingNode = await this.findById(nodeId);
    if (isFunctionalNode(existingNode)) {
      return FunctionalNodeSchema.findByIdAndUpdate(nodeId, node, {new: true});
    }
    if (isServiceNode(existingNode)) {
      return ServiceNodeSchema.findByIdAndUpdate(nodeId, node, {new: true});
    }
    throw new TypeError('Node is invalid. It must be FunctionalNode or ServiceNode.');
  }

  async updateGroup(groupId: String, group: NodeGroup): Promise<NodeGroup> {
    return NodeGroupSchema.findByIdAndUpdate(groupId, group, {new: true});
  }

  async remove(nodeId: string): Promise<any> {
    NodeSchema.findByIdAndDelete(nodeId);
  }

  async removeGroup(groupId: string): Promise<any> {
    await NodeSchema.deleteMany({group: groupId});
    return NodeGroupSchema.findByIdAndDelete(groupId);
  }

  async listPurchasedProjectNodes(type: string, current: Current) {
    const purchaseRes = await this.purchasedAppsApi.list({
      headers: {
        'Authorization': `JWT ${current.token}`,
        'organization-id': current.organization._id
      }
    });
    const purchaseApp = purchaseRes.body;
    if (!purchaseApp || !purchaseApp.items.length) {
      return [];
    }
    const items = purchaseApp.items.filter((item: any) => item.type === type);
    let nodes = await this.getLatestNodesFromItems(items);
    nodes = nodes.filter(n => n);

    return nodes;
  }

  async listMyProjectNodes(type: string, current: Current) {
    const itemsResp = await this.itemApi.list(type, undefined, {
      headers: {
        'Authorization': `JWT ${current.token}`,
        'organization-id': current.organization._id
      }
    });

    let nodes = await this.getLatestNodesFromItems(itemsResp.body);
    nodes = nodes.filter(n => n);
    return nodes;
  }

  async getLatestNodesFromItems(items: any[]): Promise<Node[]> {
    return Promise.all(
      items.map(async (item: any) => {
        return await this.getLatestNode(item);
      })
    );
  }

  // Need to rework request for marketplace settings
  async getLatestNode(item: Item) {
    if (!item.creatorsStudioProjectId && !item.provisionalNode) return undefined;

    if (item.creatorsStudioProjectId) {
      const project = item.creatorsStudioProjectId as any;
      let releases = await this.broker.call<Release[]>(this.creatorStudioTransportUri + '.ReleasesService.findByProject', {projectId: project._id});
      releases = releases.filter((r: Release) => (r.nodeTemplateStatus === 'CREATED' as any) && (r.visibility === 'PRODUCTION' as any));
      if (!releases || !releases.length) {
        return undefined;
      }
      // @ts-ignore
      const sortReleases = releases.sort((a: any, b: any) => new Date(a.createdAt) - new Date(b.createdAt));
      const lastRelease = sortReleases.pop();
      const node = await FunctionalNodeSchema.findOne({project: project._id}, undefined, {sort: {createdAt: -1}}).populate('project').lean();
      const storeRequest = await this.getStoreRequestForNode('PROJECT', project._id);
      return {
        ...node,
        lastRelease,
        requested: false,
        storeRequest,
      };
    } else {
      const node = await this.findById(item.provisionalNode);
      const storeRequest = await this.getStoreRequestForNode('PROVISIONAL', item.provisionalNode);
      return {
        ...node,
        requested: true,
        storeRequest,
      };
    }
  }

  async getReleasesByProject(projectId: string) {
    let releases = await this.broker.call<Release[]>(this.creatorStudioTransportUri + '.ReleasesService.findByProject', {projectId});
    releases = releases.filter((r: Release) => (r.nodeTemplateStatus === 'CREATED' as any) && (r.visibility === 'PRODUCTION' as any));
    if (!releases || !releases.length) {
      return [];
    }
    // @ts-ignore
    return releases.sort((a: any, b: any) => new Date(b.createdAt) - new Date(a.createdAt));
  }


  async getNodeByProject(projectId: string, releaseId: string) {
    return FunctionalNodeSchema.findOne({project: projectId, release: releaseId}).populate('project');
  }

  async getStoreRequestForNode(nodeType: 'PROJECT' | 'PROVISIONAL', queryId: string) {
    let request: string;
    let query: { [key: string]: string };
    if (nodeType === 'PROJECT') {
      request = 'MARKETPLACE.StoreRequestsService.findByProjectAction';
      query = {project: queryId};
    }
    if (nodeType === 'PROVISIONAL') {
      request = 'MARKETPLACE.StoreRequestsService.findByNodeAction';
      query = {provisionalNode: queryId};
    }
    const storeRequest = await this.broker.call<any>(request, query);
    if (storeRequest) {
      return {
        _id: storeRequest._id,
        nodeStyling: storeRequest.final && storeRequest.final.nodeStyling
          ? storeRequest.final.nodeStyling
          : (storeRequest.initial ? storeRequest.initial.nodeStyling : {})
      };
    }
    return {};
  }

  @Event()
  async createProjectNode(payload: { project: Project, release: Release }) {
    const {project, release} = payload;
    logger.info('[NodesService.createProjectNode]: payload', payload);
    try {
      let processedNode;

      const node = await this.findByProjectId(project._id);
      if (!node) {
        const node = {
          project: project._id,
          name: project.name,
          description: project.summary,
          type: NodeType.USER_NODE,
          runtime: project.runtime
        } as FunctionalNode;

        const createdNode = await this.create(node);
        processedNode = createdNode;
        logger.info('[NodesService.createProjectNode]: Node Created from Creators Studio', {nodeId: createdNode._id});
      } else {
        processedNode = node;
        logger.info('[NodesService.createProjectNode]: Node exists (from Creators Studio)', {nodeId: node._id});
      }

      if (project.projectType === ProjectType.APP) {
        try {
          this.proceedAppNode(processedNode, project, release);
        } catch (e) {
          logger.error('[NodesService.createProjectNode]: Error proceeding app', e);
        }
      }

      this.broker.emit('ReleasesService.updateNodeStatus', {
        releaseId: release._id,
        status: 'CREATED'
      }, 'CREATORS_STUDIO');

    } catch (err) {
      this.broker.emit('ReleasesService.updateNodeStatus', {
        releaseId: release._id,
        status: 'ERROR'
      }, 'CREATORS_STUDIO');
      logger.error('[NodesService.createProjectNode]: Error creating project node', err);
    }
  }

  @Event()
  async saveServiceNode(payload: { service: string, inputs: SocketMetadata[], outputs: SocketMetadata[] }) {
    logger.info('[NodesService.saveServiceNode]: Payload ', payload);
    try {
      // OLD logic for dividing SI to 3 subgraphs
      // if (payload.service === 'SMART_INFRASTRUCTURE') {
      //   return await this.processSmartServiceNode(payload);
      // }
      const existingServiceNode = await this.findByServiceId(payload.service) as any;

      console.log('[existingServiceNode]', existingServiceNode);
      const createdNode = existingServiceNode ? await this.updateServiceNode(existingServiceNode, payload) :
        await this.createServiceNode(payload);
      logger.info(`[NodesService.saveServiceNode]: Service node ${existingServiceNode ? 'updated' : 'created'} `, {nodeId: createdNode._id});

      try {
        const services = await this.sharedService.getCoreServiceById(payload.service);
        const service = services && services.constructor === Array && services.length > 0 && services[0];
        if (service && SERVICE_IGNORE_LIST.indexOf(payload.service) === -1) {
          logger.info('[NodesService.saveServiceNode]: Checking for organization graphs without updated core service subgraph', service._id);
          const graphsToUpdate = await GraphSchema.find({type: GraphType.ORGANIZATION, 'subgraphNodes.graphNodeName': {$ne: service._id}});
          logger.info('[NodesService.saveServiceNode]: Organization graphs without updated core service subgraph', graphsToUpdate.length);
          if (graphsToUpdate.length > 0) {
            for (let i = 0, l = graphsToUpdate.length; i < l; i++) {
              try {
                logger.info('[NodesService.saveServiceNode]: Updating', graphsToUpdate[i]._id.toString());
                const organizationGraph = graphsToUpdate[i] && graphsToUpdate[i].toObject() && graphsToUpdate[i].toObject();
                if (!organizationGraph) {
                  continue;
                }
                const newSubgraphNode = await this.graphInitializationService.createServiceGraphNodes(service._id, organizationGraph, organizationGraph.organization);
                await GraphSchema.findOneAndUpdate({ _id: organizationGraph._id }, { $push: { subgraphNodes: newSubgraphNode }});
                logger.info('[NodesService.saveServiceNode]: Succesfully updated', graphsToUpdate[i]._id, 'with new subgraph node', newSubgraphNode);
              } catch (err) {
                logger.error('[NodesService.saveServiceNode]: Unable to update', graphsToUpdate[i]._id, 'with new subgraph node', err);
                continue;
              }
            }
          }
        }
      } catch (err) {
        logger.error('[NodesService.saveServiceNode]: Error updating organization graphs without updated core service subgraph', err);
      }
    } catch (err) {
      logger.error('[NodesService.saveServiceNode]: Error creating service node', err);
    }
  }

  async createServiceNode(payload: { service: string, inputs: SocketMetadata[], outputs: SocketMetadata[] }) {
    const node = {
      inputs: payload.inputs,
      outputs: payload.outputs,
      name: payload.service,
      type: NodeType.SERVICE_NODE,
      description: payload.service,
      runtime: Runtime.AOS_CLOUD,
      service: payload.service
    } as ServiceNode;
    return await this.create(node);
  }

  async createDeviceNode(payload: { name: string, inputs: SocketMetadata[], outputs: SocketMetadata[] }) {
    const node = {
      inputs: payload.inputs,
      outputs: payload.outputs,
      name: payload.name,
      type: NodeType.DEVICE_NODE,
      description: payload.name,
      runtime: Runtime.AOS_CLOUD
    } as Node;
    return await this.create(node);
  }

  async updateServiceNode(existingServiceNode: ServiceNode, payload: { service: string, inputs: SocketMetadata[], outputs: SocketMetadata[] }) {
    const inputs = this.getConnectionPoints(payload.inputs, existingServiceNode.inputs);
    const outputs = this.getConnectionPoints(payload.outputs, existingServiceNode.outputs);
    const node = {
      ...existingServiceNode,
      inputs,
      outputs
    } as ServiceNode;
    logger.info('[updateServiceNode ]', node);
    return await this.update(node._id, node);
  }

  getConnectionPoints(targets: SocketMetadata[], existingTagets: SocketMetadata[]) {
    if (!targets || !targets.length) {
      return [];
    }
    return targets.map((input: SocketMetadata) => {
      const existingInput = existingTagets.find(i => (i.name === input.name) && (i.socket.toString() === input.socket.toString()));
      const _id = existingInput ? existingInput._id : new ObjectID().toString();
      return {
        ...input,
        _id
      } as SocketMetadata;
    });
  }

  async processSmartServiceNode(payload: { service: string, inputs: SocketMetadata[], outputs: SocketMetadata[] }) {
    const smartServices = Object.keys(InfrastructureType);
    smartServices.forEach(async service => {
      const inputs = payload.inputs.filter((input: any) => input.subgraphGroups.includes(service));
      const outputs = payload.outputs.filter((output: any) => output.subgraphGroups.includes(service));

      const existingServiceNode = await this.findByServiceId(service);

      console.log('[existingServiceNode]', existingServiceNode);
      const newData = {
        service,
        inputs,
        outputs
      };
      console.log('[newData]', newData);
      const createdNode = existingServiceNode ? await this.updateServiceNode(existingServiceNode, newData) :
        await this.createServiceNode(newData);
      logger.info(`[NodesService.saveServiceNode]: Service node ${existingServiceNode ? 'updated' : 'created'} `, {nodeId: createdNode._id});
    });
  }

  async getAvailableBots(organization: string, paramId: string, botName: string): Promise<IBot[]> {
    const bots = await BotSchema.find({organization: new ObjectID(organization), username: {$exists: true}});
    const botsNames = bots.map((b: any) => b.username);
    const graphsWithBots = await GraphSchema.find({
      organization,
      'graphNodes.instanceVariables.settings.parameters.value': {$in: botsNames},
      'graphNodes.instanceVariables.settings.parameters.name': botName,
    });
    const usedBots: string[] = [];
    for (const graph of graphsWithBots) {
      if (graph.graphNodes) {
        for (const graphNode of graph.graphNodes) {
          if (
            graphNode
            && graphNode.instanceVariables
            && graphNode.instanceVariables.settings
            && graphNode.instanceVariables.settings.parameters
          ) {
            for (const param of graphNode.instanceVariables.settings.parameters) {
              if (param.name === botName && param._id.toString() !== paramId) {
                usedBots.push(param.value);
              }
            }
          }
        }
      }
    }
    return bots.filter(({username}) => usedBots.indexOf(username) === -1);
  }

  /**
   * Process logic to add app into sub-graph
   *
   * @param node
   * @param project
   * @param release
   */
  async proceedAppNode(node: INode | FunctionalNode, project: Project, release: Release) {
    if (project.meta) {
      const { infrastructureId, initiatorService, stationId, deviceId, controllerId, projectId } = project.meta;

      if (initiatorService) {
        // adding app on sub-graph.
        // initiatorService not in use for now
        const reference = infrastructureId || projectId || stationId || controllerId;
        const subGraph = reference ? await GraphSchema.findOne({ reference }).lean() :
                                     await GraphSchema.findOne({ type: GraphType.SERVICE, service: initiatorService, organization: project.organization }).lean();

        if (!subGraph) {
          logger.error(`[NodesService.proceedAppNode]: Sub-graph not found `, { reference });
          return;
        }
        let graph = {} as Graph;
        // Refactor later
        const existingNodeInSubgraph = subGraph.graphNodes.find((n: any) => n.node.toString() === node._id.toString());

        if (existingNodeInSubgraph) {
          graph = await GraphSchema.findOneAndUpdate({ _id: subGraph._id, 'graphNodes._id': existingNodeInSubgraph._id }, { $set: { 'graphNodes.$.release': release } }).lean();
        } else {
          // add a node if it doesn`t exists
          const uniqueName = this.sharedService.getUniqueName(subGraph, node.name);
          const graphNode = {
            graphNodeName: uniqueName,
            node: node._id,
            position: [],
            release
          } as any;
          if (deviceId) {
            graphNode.device = deviceId;
          }
          graph = (await GraphSchema.findOneAndUpdate({ _id: subGraph._id }, { $push: { graphNodes: graphNode } }, { new: true })).toObject();
        }

        const createdGraphNode = graph.graphNodes.find((n: any) => n.node.toString() === node._id.toString());
        logger.info(`[NodesService.proceedAppNode][${createdGraphNode._id}] Emitting to creators studio`, { graphNodeId: createdGraphNode._id, releaseId: release._id });
        this.broker.emit('AutomationService.createdGraphNode', { graphNodeId: createdGraphNode._id.toString(), releaseId: release._id.toString() }, this.creatorStudioTransportUri);

        await this.graphsService.publishGraphNode(createdGraphNode._id.toString(), graph.organization, false);
        logger.info(`[NodesService.proceedAppNode.publishGraphNode][${createdGraphNode._id}] Publishing node to graph`);
      }
    }
  }

}
