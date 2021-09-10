import { Current, logger } from '@aitheon/core-server';
import { Request, Response } from 'express';
import { Authorized, Body, CurrentUser, Delete, Get, JsonController, Param, Post, Put, Req, Res, QueryParam } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { Inject } from 'typedi';
import { ServiceDeploymentsService } from './service-deployments.service';


@Authorized()
@JsonController('/api/service-deployments')
export class ServiceDeploymentsController {


  @Inject()
  serviceDeploymentsService: ServiceDeploymentsService;


  @Get('/:serviceId')
  @OpenAPI({ description: 'Service output by name inputs list', operationId: 'listInputs' })
  async list(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @QueryParam('name') name: string, @Param('serviceId') serviceId: string) {
    try {

      if (current.organization == undefined) {
        return response.status(500).json({
          message: 'Undefined organization'
        });
      }

      const serviceDeployment = await this.serviceDeploymentsService.findByName(current.organization._id, serviceId, name);
      return response.json(serviceDeployment);
    } catch (err) {
      logger.error('[get service deployment by name]', err);
      return response.status(422).json({ message: err.message || err });
    }
  }

}
