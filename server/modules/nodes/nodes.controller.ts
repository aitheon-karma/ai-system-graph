import { Current, logger } from '@aitheon/core-server';
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
  QueryParam
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { Inject } from 'typedi';
import { NodesService } from './nodes.service';

@Authorized()
@JsonController('/api/nodes')
export class NodesController {

  @Inject()
  nodesService: NodesService;

  @Get('/')
  @OpenAPI({ description: 'all nodes list', operationId: 'list' })
  async list(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {
      const nodes = await this.nodesService.findAll();
      return response.json(nodes);
    } catch (err) {
      logger.error('[list all nodes]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/functional')
  @OpenAPI({ description: 'functional nodes list', operationId: 'listFunctionalNodes' })
  async listFunctionalNodes(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {
      const nodes = await this.nodesService.findAllFunctionalNodes();
      return response.json(nodes);
    } catch (err) {
      logger.error('[list functional nodes]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/services')
  @OpenAPI({ description: 'service nodes list', operationId: 'listServiceNodes' })
  async listServiceNodes(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {
      const nodes = await this.nodesService.findAllServiceNodes();
      return response.json(nodes);
    } catch (err) {
      logger.error('[list service nodes]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/groups')
  @OpenAPI({ description: 'nodes groups list', operationId: 'listGroups' })
  async listGroups(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    try {
      const nodesGroups = await this.nodesService.findAllGroups();
      return response.json(nodesGroups);
    } catch (err) {
      logger.error('[list all nodes groups]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  // TODO bug workaround: https://github.com/typestack/routing-controllers/issues/220
  @Get('/by/:id')
  @OpenAPI({ description: 'get any node by id', operationId: 'getById' })
  async getById(@CurrentUser() current: Current, @Param('id') id: string, @Res() response: Response) {
    try {
      const result = await this.nodesService.findById(id);
      return response.json(result);
    } catch (err) {
      logger.error('[get any node by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/services/:serviceId')
  @OpenAPI({ description: 'get service node by service id', operationId: 'getServiceNode' })
  async getServiceNode(@CurrentUser() current: Current, @Param('serviceId') serviceId: string, @Res() response: Response, @Req() request: Request) {
    try {
      const serviceNode = await this.nodesService.findByServiceId(serviceId);
      return response.json(serviceNode);
    } catch (err) {
      logger.error('[get service node by service id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/projects/:projectId')
  @OpenAPI({ description: 'get nodes by project id', operationId: 'getByProjectId' })
  async getByProjectId(@CurrentUser() current: Current, @Param('projectId') projectId: string, @Res() response: Response, @Req() request: Request) {
    try {
      const nodes = await this.nodesService.findByProjectId(projectId);
      return response.json(nodes);
    } catch (err) {
      logger.error('[get nodes by project id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/:id/isaac/build')
  @OpenAPI({ description: 'generate isaac build for node by id', operationId: 'getIsaacBuildById' })
  async getIsaacBuildById(@CurrentUser() current: Current, @Param('id') id: string, @Res() response: Response) {
    try {
      const bazelFileName = `BUILD-${id}`;
      const result = await this.nodesService.generateIsaacBuildById(id);
      return response.attachment(bazelFileName).send(result.toString());
    } catch (err) {
      logger.error('[generate isaac build for node by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/groups/:groupId')
  @OpenAPI({ description: 'get group by id', operationId: 'getGroupById' })
  async getGroupById(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('groupId') groupId: string) {
    try {
      const group = await this.nodesService.findGroupById(groupId);
      return response.json(group);
    } catch (err) {
      logger.error('[get group by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/groups/:groupId/nodes')
  @OpenAPI({ description: 'nodes list by group', operationId: 'listByGroup' })
  async listByGroup(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('groupId') groupId: string) {
    try {
      const nodes = await this.nodesService.findByGroup(groupId);
      return response.json(nodes);
    } catch (err) {
      logger.error('[list nodes by group]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/')
  @OpenAPI({ description: 'create node', operationId: 'create' })
  async create(@CurrentUser() current: Current, @Body() document: any, @Res() response: Response) {
    try {
      const result = await this.nodesService.create(document);
      return response.json(result);
    } catch (err) {
      logger.error('[create node]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Post('/groups')
  @OpenAPI({ description: 'create node group', operationId: 'createGroup' })
  async createGroup(@CurrentUser() current: Current, @Body() document: any, @Res() response: Response) {
    try {
      const result = await this.nodesService.createGroup(document);
      return response.json(result);
    } catch (err) {
      logger.error('[create node group]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/:id')
  @OpenAPI({ description: 'update node by id', operationId: 'update' })
  async update(@CurrentUser() current: Current, @Param('id') id: string, @Body() updateDocument: any, @Res() response: Response, @Req() request: Request) {
    try {
      const result = await this.nodesService.update(id, updateDocument);
      return response.json(result);
    } catch (err) {
      logger.error('[update node by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Put('/groups/:id')
  @OpenAPI({ description: 'update node group by id', operationId: 'updateGroup' })
  async updateGroup(@CurrentUser() current: Current, @Param('id') id: string, @Body() updateDocument: any, @Res() response: Response, @Req() request: Request) {
    try {
      const result = await this.nodesService.updateGroup(id, updateDocument);
      return response.json(result);
    } catch (err) {
      logger.error('[update node group by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Delete('/:id')
  @OpenAPI({ description: 'Remove node by id', operationId: 'removeById' })
  async removeOne(@Res() response: Response, @Param('id') id: string) {
    try {
      await this.nodesService.remove(id);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[delete node by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Delete('/groups/:id')
  @OpenAPI({ description: 'Remove node group by id', operationId: 'removeGroupById' })
  async removeGroupById(@Res() response: Response, @Param('id') id: string) {
    try {
      await this.nodesService.removeGroup(id);
      return response.sendStatus(204);
    } catch (err) {
      logger.error('[delete node group by id]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

  @Get('/items/projects/nodes')
  @OpenAPI({ description: 'Get nodes from projects', operationId: 'listProjectNodes' })
  async listProjectNodes(@QueryParam('type') type: string, @QueryParam('purchased') purchased: boolean, @Res() response: Response, @Req() request: Request, @CurrentUser() current: Current) {
    try {
      const result = purchased
        ? await this.nodesService.listPurchasedProjectNodes(type, current)
        : await this.nodesService.listMyProjectNodes(type, current);
      return response.json(result);
    } catch (err) {
      logger.error('[list project nodes]', err);
    }
  }

  @Get('/releases/:projectId')
  @OpenAPI({ description: 'Get releases for project', operationId: 'getReleasesByProject' })
  async getReleasesByProject(@Param('projectId') projectId: string, @Res() response: Response) {
    try {
      const result = await this.nodesService.getReleasesByProject(projectId);
      return response.json(result);
    } catch (err) {
      logger.error('[get releases by project]', err);
    }
  }

  @Get('/releases/:projectId/:releaseId')
  @OpenAPI({ description: 'Get node by release', operationId: 'getNodeByRelease' })
  async getNodeByRelease(@Param('projectId') projectId: string, @Param('releaseId') releaseId: string, @Res() response: Response) {
    try {
      const result = await this.nodesService.getNodeByProject(projectId, releaseId);
      return response.json(result);
    } catch (err) {
      logger.error('[get node by release]', err);
    }
  }

  @Get('/bots/by/:paramId/:botName')
  @OpenAPI({ description: 'Get bots by parameter', operationId: 'getAvailableBotsByParam' })
  async getAvailableBotsByParam(
    @Param('paramId') paramId: string,
    @Param('botName') botName: string,
    @Res() response: Response,
    @CurrentUser() current: Current,
  ) {
    try {
      if (current.organization === undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const result = await this.nodesService.getAvailableBots(current.organization._id.toString(), paramId, botName);
      return response.json(result);
    } catch (err) {
      logger.error('[get bots by parameter]', err);
    }
  }

}
