import { Current, logger } from '@aitheon/core-server';
import { InfrastructureApi } from '@aitheon/smart-infrastructure-server';
import { Request, Response } from 'express';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
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
import { GraphNodeLayout } from './graph-node-layout.model';
import Container, { Service, Inject } from 'typedi';
import { GraphNodeLayoutService } from './graph-node-layout.service';

const REQUESTED_WITH = 'creators-studio';

@Authorized()
@JsonController('/api/node-layout')
export class GraphNodeLayoutController {

  constructor() {}

  @Inject()
  layoutService: GraphNodeLayoutService;


  @Post('/:projectId')
  @OpenAPI({ description: 'Create a layout', operationId: 'create' })
  async create(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Body() layout: GraphNodeLayout, @Param('projectId') projectId: string, @QueryParam('graphNodeId') graphNodeId: string) {
    try {
      layout.organization = current.organization && current.organization._id;
      layout.user = current.user._id;
      layout.projectId = projectId;
      if (graphNodeId) {
        layout.graphNodeId = graphNodeId;
      }
      const owner = request.headers['X-Requested-With'.toLowerCase()] === REQUESTED_WITH;
      const createdLayout = await this.layoutService.create(layout, owner);
      return response.json(createdLayout);
    } catch (err) {
      logger.error('[create application layout]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }


  @Put('/:projectId')
  @OpenAPI({ description: 'Update a layout', operationId: 'update' })
  async update(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Body() layout: GraphNodeLayout, @Param('projectId') projectId: string, @QueryParam('graphNodeId') graphNodeId: string) {
    try {
      layout.organization = current.organization && current.organization._id;
      layout.user = current.user._id;
      layout.projectId = projectId;
      if (graphNodeId) {
        layout.graphNodeId = graphNodeId;
      }
      const owner = request.headers['X-Requested-With'.toLowerCase()] === REQUESTED_WITH;
      const updatedLayout = await this.layoutService.update(layout, owner);
      return response.json(updatedLayout);
    } catch (err) {
      logger.error('[update application layout]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }


  @Get('/:projectId')
  @OpenAPI({ description: 'Find by Graph Node id', operationId: 'findByProjectId' })
  async findByProjectId(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('projectId') projectId: string, @QueryParam('graphNodeId') graphNodeId: string) {
    const owner = request.headers['X-Requested-With'.toLowerCase()] === REQUESTED_WITH;
    const layouts = await this.layoutService.findByProjectId(projectId, owner, current, graphNodeId);
    return response.json(layouts);
  }


}
