import { Current, logger } from '@aitheon/core-server';
import { InfrastructureApi } from '@aitheon/smart-infrastructure-server';
import { Request, Response } from 'express';
import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  Param,
  Post,
  Put,
  Req,
  Res,
  QueryParam,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Inject } from 'typedi';
import { DevicesService } from '../shared/devices.service';
import { GraphsService } from './graph.service';
import { SubgraphGraphNode, GraphNodeStatus, FunctionalGraphNode, UIElement, UpdateUIElements } from './graph-nodes.model';
import { sign } from 'jsonwebtoken';
import { environment } from '../../environment';
import { hasGraphAccess } from '../shared/accesses';
import { Accesses } from '../shared/accesses';
import { SubgraphCreation, GraphSubType, AddNodesToSubgraphSchema, DeployNode, DriverToController, RemoveApplication, RemoveDevice, AddAutomation, DevicesFromStation, DevicesToSubgraph, ControllerFromOrg, ControllerToSubgraph, SpecialSubgraphCreation, SubgraphCreationByRef, ServiceGraph } from './graph.model';
import { IFunctionalNode, FunctionalNodeSchema, FunctionalNode } from '../nodes/node-functional.model';
import { NodesService } from '../nodes/nodes.service';
import { FlattenGraph } from './flatten-graph.model';

@Authorized()
@JsonController('/api/graphs')
export class GraphsController {

  infrastructureApi: InfrastructureApi;

  constructor() {
    this.infrastructureApi = new InfrastructureApi(`https://${process.env.DOMAIN || 'dev.aitheon.com'}/smart-infrastructure`);
  }

  @Inject()
  graphService: GraphsService;

  @Inject()
  devicesService: DevicesService;

  @Inject()
  nodesService: NodesService;


  @Get('/')
  @OpenAPI({ description: 'Graphs list', operationId: 'list' })
  async list(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const organization = current.organization._id;
      const graphs = await this.graphService.findAll(organization);
      return response.json(graphs);
    } catch (err) {
      logger.error('[list all graphs]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/organization/graph')
  @OpenAPI({ description: 'get graph for organization', operationId: 'getOrganizationGraph' })
  async getOrganizationGraph(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      let graph = await this.graphService.findOrgGraph(current.organization._id) as any;

      if (!graph) {
        await this.graphService.initOrganization({ user: current.user, organization: current.organization });
      }

      graph = await this.graphService.findOrgGraph(current.organization._id) as any;

      graph = await this.graphService.processGeneratingGraph(graph, true, true, true);

      return response.json(graph);
    } catch (err) {
      logger.error('[get graph for organization]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/organization/core')
  @OpenAPI({ description: 'get core graph', operationId: 'getCoreGraph' })
  async getCoreGraph(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {

      if (!hasGraphAccess(current.user, Accesses.CORE_GRAPH_ACCESS)) {
        return response.status(403).json({
          message: 'Forbidden'
        });
      }

      let graph = await this.graphService.findCoreGraph();

      if (!graph) {
        await this.graphService.initCoreGraph();
        graph = await this.graphService.findCoreGraph();
      }

      graph = await this.graphService.processGeneratingGraph(graph, true, true, true);

      return response.json(graph);
    } catch (err) {
      logger.error('[get core graph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/services/:serviceId')
  @OpenAPI({ description: 'Graph by service', operationId: 'getByService' })
  async getByService(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @Req() request: Request,
    @Param('serviceId') serviceId: string
  ) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const organization = current.organization._id;
      let graph = await this.graphService.findByService(serviceId, organization);

      if (!graph.serviceGraphNode.node) {
        graph.serviceGraphNode.node = await this.graphService.checkAlreadyExistedServiceNode(serviceId, graph._id);
      }

      graph = await this.graphService.processGeneratingGraph(graph, true, true, true) as ServiceGraph;

      return response.json(graph);
    } catch (err) {
      logger.error('[list graphs by service]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:id')
  @OpenAPI({ description: 'get graph by id', operationId: 'getById' })
  async getById(@CurrentUser() current: Current, @Param('id') id: string, @Res() response: Response, @QueryParam('populateReference') populateReference: boolean) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      let graph = await this.graphService.findById(id);

      if (!graph) {
        return response.status(500).json({
          message: 'No graph with such ID.'
        });
      }

      if (populateReference && graph.reference) {
        graph.reference = await this.graphService.populateReference(graph.reference, graph.subType, current.token, graph.organization, (graph as any).service);
      }

      graph = await this.graphService.processGeneratingGraph(graph, true, true, true);
      return response.json(graph);
    } catch (err) {
      logger.error('[get graph by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/graph-node/:graphNodeId')
  @OpenAPI({ description: 'get graph by graph-node id', operationId: 'getByGraphNodeId' })
  async getByGraphNodeId(@CurrentUser() current: Current, @Param('graphNodeId') graphNodeId: string, @Res() response: Response) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      let graph = await this.graphService.findByGraphNodeId(graphNodeId);

      if (!graph) {
        return response.status(500).json({
          message: 'No graph with such graph node.'
        });
      }

      graph = await this.graphService.processGeneratingGraph(graph, true);

      return response.json(graph);
    } catch (err) {
      logger.error('[get graph by graph-node id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/organization/applications')
  @OpenAPI({ description: 'get organization applications', operationId: 'getGraphOrgApplications' })
  async getGraphOrgApplications(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {

      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const applications = await this.graphService.getGraphOrgApplications(current.organization._id, true);

      return response.json(applications);
    } catch (err) {
      logger.error('[get organization applications]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/reference/type')
  @OpenAPI({ description: 'get graph by reference', operationId: 'getReferenceType' })
  async getReferenceType(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @QueryParam('reference') reference: string,
    @QueryParam('subType') subType: GraphSubType,
    @QueryParam('populateProject') populateProject: boolean,
    @QueryParam('checkIsLatest') checkIsLatest: boolean
  ) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const graph = await this.graphService.findByReference(reference, subType, populateProject, checkIsLatest);
      return response.json(graph);
    } catch (err) {
      logger.error('[get graph by reference]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:graphId/logs')
  @OpenAPI({ description: 'get graph logs', operationId: 'getLogsByGraph' })
  async getLogsByGraph(@CurrentUser() current: Current, @Param('graphId') graphId: string, @Res() response: Response,
   @QueryParam('from') from: number,
   @QueryParam('size') size: number,
   @QueryParam('graphNodeId') graphNodeId: string
    ) {
    try {

      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const logs = await this.graphService.getGraphLogs(graphId, from, size, graphNodeId);
      return response.json(logs);
    } catch (err) {
      logger.error('[get graph logs]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:graphId/breadcrumbs')
  @OpenAPI({ description: 'get graph breadcrumbs', operationId: 'getBreadcrumbsByGraph' })
  async getBreadcrumbsByGraph(@CurrentUser() current: Current, @Param('graphId') graphId: string, @Res() response: Response) {
    try {

      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const logs = await this.graphService.getBreadcrumbs(graphId);
      return response.json(logs);
    } catch (err) {
      logger.error('[get graph breadcrumbs]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:graphId/logs/proxy')
  @OpenAPI({ description: 'get graph logs', operationId: 'getLoggingProxy' })
  async getLoggingProxy(@CurrentUser() current: Current, @Param('graphId') graphId: string, @Res() response: Response) {
    try {

      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      const graph = await this.graphService.findById(graphId);
      if (!graph) {
        return response.status(404).json({
          message: 'No graph'
        });
      }
      if (graph.organization.toString() != current.organization._id) {
        return response.status(500).json({
          message: 'No access'
        });
      }

      const token = sign({ graphId }, environment.loggingProxy.jwtSecret, { expiresIn: '12h' });
      return response.json({ token });
    } catch (err) {
      logger.error('[get graph logs proxy]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/deployment/graph')
  @OpenAPI({ description: 'Deploy graph', operationId: 'deployGraph' })
  @ResponseSchema(FlattenGraph)
  async deployGraph(@CurrentUser() current: Current, @Res() response: Response) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      const result = await this.graphService.deployGraph(current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[deployGraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/deployment/sub-graph/:subgraphId')
  @OpenAPI({ description: 'Deploy sub graph', operationId: 'deploySubGraph' })
  @ResponseSchema(FlattenGraph)
  async deploySubGraph(@CurrentUser() current: Current, @Res() response: Response, @Param('subgraphId') subgraphId: string) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      const result = await this.graphService.deploySubGraph(subgraphId);
      return response.json(result);
    } catch (err) {
      logger.error('[deploySubGraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/deployment/node')
  @OpenAPI({ description: 'Deploy node', operationId: 'deployNode' })
  async deployNode(@CurrentUser() current: Current, @Res() response: Response, @Body() body: DeployNode) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      body.publish ? await this.graphService.publishGraphNode(body.graphNodeId, current.organization._id, body.updateToLatestRelease) :
                     await this.graphService.stopGraphNode(body.graphNodeId, current.organization._id, false);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[Deploy node]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/deployment/graph/stop')
  @OpenAPI({ description: 'Stop running graph', operationId: 'stopGraph' })
  async stopGraph(@CurrentUser() current: Current, @Res() response: Response) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      const result = await this.graphService.stopGraph(current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[stop org graph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/deployment/sub-graph/:subgraphId/stop')
  @OpenAPI({ description: 'Stop running sub-graph', operationId: 'stopSubGraph' })
  @ResponseSchema(FlattenGraph)
  async stopSubGraph(@CurrentUser() current: Current, @Res() response: Response, @Param('subgraphId') subgraphId: string) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }
      const result = await this.graphService.stopSubGraph(subgraphId);
      return response.json(result);
    } catch (err) {
      logger.error('[stop sub graph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:id/isaac/app')
  @OpenAPI({ description: 'generate isaac app by id', operationId: 'getIsaacAppById' })
  async getIsaacAppById(@CurrentUser() current: Current, @Param('id') id: string, @Res() response: Response) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const { app, build } = await this.graphService.buildIsaacPackageById(id);

      /* TODO: Reserved for future file generation usage:
      const file = await fs.writeFile(join(__dirname, build.getJsonAppName()), JSON.stringify(app)).catch(err => new Error(err));
      if (file instanceof Error) {
        return response.status(500).json({ message: (file as Error).message });
      }*/

      return response.attachment(build.getJsonName()).json(app);
    } catch (err) {
      logger.error('[get isaac app by graph id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:id/isaac/app/build')
  @OpenAPI({ description: 'generate isaac app build by id', operationId: 'getIsaacGraphBuildById' })
  async getIsaacGraphBuildById(@CurrentUser() current: Current, @Param('id') id: string, @Res() response: Response) {
    try {
      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const { build } = await this.graphService.buildIsaacPackageById(id);
      const bazelFileName = `BUILD-${id}`;

      /* TODO: Reserved for future file generation usage:
      const file = await fs.writeFile(join(__dirname, bazelFileName), build.toString()).catch(err => new Error(err));
      if (file instanceof Error) {
        return response.status(500).json({ message: (file as Error).message });
      }*/

      return response.attachment(bazelFileName).send(build.toString());
    } catch (err) {
      logger.error('[get isaac app build by graph id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:id/isaac/subgraph')
  @OpenAPI({ description: 'generate isaac subgraph for by id', operationId: 'getIsaacSubgraphById' })
  async getIsaacSubgraphById(@CurrentUser() current: Current, @Param('id') id: string, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const { app, build } = await this.graphService.buildIsaacSubgraphPackageById(id);

      /* TODO: Reserved for future file generation usage:
      const file = await fs.writeFile(join(__dirname, build.getJsonAppName()), JSON.stringify(app)).catch(err => new Error(err));
      if (file instanceof Error) {
        return response.status(500).json({ message: (file as Error).message });
      }*/

      return response.attachment(build.getJsonName()).json(app);
    } catch (err) {
      logger.error('[generate isaac subgraph for by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:id/isaac/subgraph/build')
  @OpenAPI({ description: 'generate isaac subgraph build by id', operationId: 'getIsaacSubgraphBuildById' })
  async getIsaacSubgraphBuildById(@CurrentUser() current: Current, @Param('id') id: string, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const { build } = await this.graphService.buildIsaacSubgraphPackageById(id);
      const bazelFileName = `BUILD-${id}`;

      /* TODO: Reserved for future file generation usage:
      const file = await fs.writeFile(join(__dirname, bazelFileName), build.toString()).catch(err => new Error(err));
      if (file instanceof Error) {
        return response.status(500).json({ message: (file as Error).message });
      }*/

      return response.attachment(bazelFileName).send(build.toString());
    } catch (err) {
      logger.error('[get isaac subgraph build by graph id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/search')
  @OpenAPI({ description: 'get graph by filter', operationId: 'getBySearch' })
  async getBySearch(@CurrentUser() current: Current, @Body() body: any, @Res() response: Response) {

    try {
      if (body.core) {
        // TODO Rework hardcoded org id. Must be api from Admin service or Platform support
        body.organization = '5b456dc1a8ed350010ce7244';
      } else {
        body.organization = current.organization._id;
      }

      if (body.service === 'SMART_INFRASTRUCTURE' && body.item) {
        const infrastructure = await this.infrastructureApi.getById(body.item, { headers: { 'Authorization': `JWT ${current.token}` } });

        if (!infrastructure || !infrastructure.body) {
          return response.status(500).json({ message: 'No infrastructure with this id' });
        }
      }
      // Device-manager checker for existing device
      // if (body.service === 'DEVICE_MANAGER' && body.item) {
      //   const device = await this.devicesService.findById(current.token, body.item, current.organization._id);

      //   if (!device || !device.body) {
      //     return response.status(500).json({ message: 'No device with this id' });
      //   }
      // }

      const result = await this.graphService.getBySearch(body);
      return response.json(result);
    } catch (err) {
      logger.error('[get graph by filter]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/')
  @OpenAPI({ description: 'create graph', operationId: 'create' })
  async create(@CurrentUser() current: Current, @Body() document: any, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      document.organization = current.organization._id;
      const result = await this.graphService.create(document);
      return response.json(result);
    } catch (err) {
      logger.error('[create graph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/:id')
  @OpenAPI({ description: 'update graph by id', operationId: 'update' })
  async update(
    @CurrentUser() current: Current,
    @Param('id') id: string,
    @Body() updateDocument: any,
    @Res() response: Response,
    @Req() request: Request,
    @QueryParam('populate') populate: boolean,
  ) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const createdSubgraphs = (updateDocument.subgraphNodes || []).filter((sN: SubgraphGraphNode) => sN.status === GraphNodeStatus.CREATED);
      if (createdSubgraphs.length) {
        const savedSubgraphNodes = await this.graphService.processCreatedSubGraphs(updateDocument);
        updateDocument.subgraphNodes = savedSubgraphNodes;
      }

      let result = await this.graphService.update(id, updateDocument, populate) as any;
      result = result.toObject();

      if (populate) {
        result = await this.graphService.processGeneratingGraph(result, true);
      }

      return response.json(result);
    } catch (err) {
      logger.error('[update graph by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }


  @Put('/organization/core/services/toggle')
  @OpenAPI({ description: 'Enable or disable service core subgraph', operationId: 'toggleCoreServiceGraph' })
  async toggleCoreServiceGraph(@CurrentUser() current: any, @Res() response: Response, @Req() request: Request, @Body() body: { service: string } ) {
    try {

      if (!hasGraphAccess(current.user, Accesses.CORE_GRAPH_ACCESS)) {
        return response.status(403).json({
          message: 'Forbidden'
        });
      }

      const graph = await this.graphService.findCoreGraph();

      if (!graph) {
        return response.status(403).json({
          message: 'No core graph yet'
        });
      }

      await this.graphService.toggleCoreServiceSubgraph(graph, body.service);

      return response.json(graph);
    } catch (err) {
      logger.error('[get core graph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/templates/:id')
  @OpenAPI({ description: 'update template graph by id', operationId: 'updateTemplate' })
  async updateTemplate(@CurrentUser() current: Current, @Param('id') id: string, @Body() updateDocument: any, @Res() response: Response, @Req() request: Request) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.update(id, updateDocument);

      await this.graphService.updateLinkedGraphs(id);

      return response.json(result);
    } catch (err) {
      logger.error('[update template graph by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Delete('/')
  @OpenAPI({ description: 'Remove graph by id', operationId: 'remove' })
  async removeOne(@CurrentUser() current: Current, @Res() response: Response, @Body() body: any) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.remove(body.data);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove graph by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/graph-nodes/application')
  @OpenAPI({ description: 'Remove graph node for application', operationId: 'removeApplication' })
  async removeApplication(@CurrentUser() current: Current, @Res() response: Response, @Body() body: RemoveApplication) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.removeApplication(body.graphNodeId, current.organization._id);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove application]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/graph-nodes/device')
  @OpenAPI({ description: 'Remove graph node for device', operationId: 'removeDevice' })
  async removeDevice(@CurrentUser() current: Current, @Res() response: Response, @Body() body: RemoveDevice) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.removeDevice(body, current.organization._id);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove device]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/graph-nodes/station/controller')
  @OpenAPI({ description: 'Remove graph node for controller from station', operationId: 'removeController' })
  async removeController(@CurrentUser() current: Current, @Res() response: Response, @Body() body: DevicesFromStation) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.removeControllerFromStation(body, current.organization._id);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove controller]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/graph-nodes/organization/controller')
  @OpenAPI({ description: 'Remove graph node for controller with linked elements from organization', operationId: 'removeControllerFromOrg' })
  async removeControllerFromOrg(@CurrentUser() current: Current, @Res() response: Response, @Body() body: ControllerFromOrg) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.removeControllerFromOrg(body, current.organization._id);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove controller from org]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Delete('/services/:serviceId')
  @OpenAPI({ description: 'Disable service graph', operationId: 'disableServiceGraph' })
  async disableServiceGraph(@CurrentUser() current: Current, @Res() response: Response, @Param('serviceId') serviceId: string) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.disableServiceGraph(serviceId, current.organization._id, false);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[disable service]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/smart-infrastructure/infrastructures')
  @OpenAPI({ description: 'create infrastructure subgraph', operationId: 'createInfrastructureSubgraph' })
  async createInfrastructureSubgraph(@CurrentUser() current: Current, @Body() body: SubgraphCreation, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.createInfrastructureSubgraph(body, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[create infrastructure]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/smart-infrastructure/floors')
  @OpenAPI({ description: 'create floor subgraph', operationId: 'createFloorSubgraph' })
  async createFloorSubgraph(@CurrentUser() current: Current, @Body() body: SubgraphCreation, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.createFloorSubgraph(body, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[create floor]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/smart-infrastructure/stations/floor/add')
  @OpenAPI({ description: 'add station subgraph to a floor subgraph', operationId: 'addStationToFloor' })
  async addStationToFloor(@CurrentUser() current: Current, @Body() data: { infrastructureId: string, floorId: string, stationId: string, name: string }, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.addStationToFloor(data, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[add to floor]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/smart-infrastructure/stations/floor/remove')
  @OpenAPI({ description: 'remove station subgraph to a infra subgraph', operationId: 'removeStationFromFloor' })
  async removeStationFromFloor(@CurrentUser() current: Current, @Body() data: { infrastructureId: string, floorId: string, stationId: string, name: string }, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.removeStationFromFloor(data, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[remove from floor]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Delete('/smart-infrastructure/stations/:stationId')
  @OpenAPI({ description: 'remove station subgraph', operationId: 'removeStationSubGraph' })
  async removeStationSubGraph(@CurrentUser() current: Current, @Res() response: Response, @Param('stationId') stationId: string) {
    try {
      await this.graphService.removeStationSubGraph(stationId);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove station subgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Delete('/smart-infrastructure/floors/:floorId')
  @OpenAPI({ description: 'remove station subgraph', operationId: 'removeFloorSubGraph' })
  async removeFloorSubGraph(@CurrentUser() current: Current, @Res() response: Response, @Param('floorId') floorId: string) {
    try {
      await this.graphService.removeFloorSubGraph(floorId);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove floor subgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Delete('/smart-infrastructure/infrastructures/:infrastructureId')
  @OpenAPI({ description: 'remove station subgraph', operationId: 'removeInfrastructureSubGraph' })
  async removeInfrastructureSubGraph(@CurrentUser() current: Current, @Res() response: Response, @Param('infrastructureId') infrastructureId: string) {
    try {
      await this.graphService.removeInfrastructureSubGraph(infrastructureId);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[remove infrastructure subgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/smart-infrastructure/stations')
  @OpenAPI({ description: 'create station subgraph', operationId: 'createStationSubgraph' })
  async createStationSubgraph(@CurrentUser() current: Current, @Body() body: SubgraphCreation, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.createStationSubgraph(body, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[create createStationSubgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/smart-infrastructure/devices/add')
  @OpenAPI({ description: 'add device to subgraph', operationId: 'addDeviceToSubgraph' })
  async addDeviceToSubgraph(@CurrentUser() current: Current, @Body() body: DevicesToSubgraph, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.addDeviceToSubgraph(body, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[addDeviceToSubgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/smart-infrastructure/controllers/add')
  @OpenAPI({ description: 'add controller to subgraph', operationId: 'addControllerToSubgraph' })
  async addControllerToSubgraph(@CurrentUser() current: Current, @Body() body: ControllerToSubgraph, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.addControllerToSubgraph(body, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[addControllerToSubgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }


  @Put('/smart-infrastructure/devices/driver/add')
  @OpenAPI({ description: 'add driver to controller', operationId: 'addDriverToController' })
  async addDriverToController(@CurrentUser() current: Current, @Body() body: DriverToController, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.addDriverToController(body.device, body.projectId, current.organization._id, body.reference);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[addDriverToController]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/smart-infrastructure/devices/driver/remove')
  @OpenAPI({ description: 'remove driver from controller', operationId: 'removeDriverFromController' })
  async removeDriverFromController(@CurrentUser() current: Current, @Body() body: DriverToController, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.removeDriverFromController(body.device, current.organization._id, body.reference);
      return response.json(result);
    } catch (err) {
      logger.error('[removeDriverFromController]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/smart-infrastructure/subgraph/:reference/nodes')
  @OpenAPI({ description: 'add nodes to smart-infrastructure subgraph', operationId: 'addAppsToSubGraph' })
  async addAppsToSubGraph(@CurrentUser() current: Current, @Param('reference') reference: string, @Body() body: AddNodesToSubgraphSchema, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const subGraph = await this.graphService.getSubgraphByRef(reference);

      if (!subGraph) {
        return response.status(404).json({
          message: 'smart-infrastructure subgraph not found'
        });
      }

      const nodes = await this.nodesService.findByProjectIds(body.projects) as IFunctionalNode[];

      const result = await this.graphService.addNodesToSubgraphByRef(subGraph, nodes, body.deviceId);
      result.forEach(async (graphNode: FunctionalGraphNode) => {
        await this.graphService.publishGraphNode(graphNode._id, current.organization._id, false);
      });
      return response.json(result);
    } catch (err) {
      logger.error('[put addAppsToSubGraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/automation/services/add')
  @OpenAPI({ description: 'add automation to a services', operationId: 'addAutomationToService' })
  async addAutomationToService(@CurrentUser() current: Current, @Body() body: AddAutomation, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const subGraph = await this.graphService.getSubgraphByQuery(body.referenceType, body.reference, current.organization._id);

      if (!subGraph) {
        return response.status(503).json({
          message: 'Current subgraph not found'
        });
      }

      const node = (await FunctionalNodeSchema.findOne({project: body.projectId}, undefined, {sort: {createdAt: -1}})
                                              .populate('project', '_id name').lean()) as FunctionalNode;

      const graphNode = await this.graphService.addNodeToSubgraphByRef(subGraph, node);
      this.graphService.publishGraphNode(graphNode._id, current.organization._id, false);
      return response.json(graphNode);
    } catch (err) {
      logger.error('[put add automation]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }


  @Post('/sub-graphs/special')
  @OpenAPI({ description: 'create project subgraph', operationId: 'createSpecialSubgraph' })
  async createProjectSubgraph(@CurrentUser() current: Current, @Body() body: SpecialSubgraphCreation, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.createSpecialSubgraph(body, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[create Project Subgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }


  @Put('/graph-nodes/ui-elements')
  @OpenAPI({ description: 'Update size and position of application ui elements', operationId: 'updateUIElements' })
  async updateUIElements(@CurrentUser() current: Current, @Res() response: Response, @Body() body: UpdateUIElements) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      await this.graphService.updateUIElements(body);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[updateUIElements]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/sub-graphs/reference')
  @OpenAPI({ description: 'create subgraph inside graph by reference', operationId: 'createSubgraph' })
  async createSubgraph(@CurrentUser() current: Current, @Body() body: SubgraphCreationByRef, @Res() response: Response) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.graphService.createSubgraphByRef(body, current.organization._id);
      return response.json(result);
    } catch (err) {
      logger.error('[create subgraph]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

}
