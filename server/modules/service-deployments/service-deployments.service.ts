import { Service, Inject } from 'typedi';
import { ServiceDeployment, ServiceDeploymentSchema } from './service-deployment.model';
import { FlattenGraph, FlattenGraphNode } from '../graph/flatten-graph.model';
import { NodeType } from '../nodes/node.model';
import { logger } from '@aitheon/core-server';


@Service()
export class ServiceDeploymentsService {

  async findByName(organization: string, service: string, outputName: string): Promise<ServiceDeployment> {
    const serviceDeployment = await ServiceDeploymentSchema.findOne({ organization, service, outputName });
    return serviceDeployment;
  }

  async create(deployment: ServiceDeployment): Promise<ServiceDeployment> {
    const serviceDeployment = await ServiceDeploymentSchema.create(deployment);
    return serviceDeployment;
  }

  async update(deploymentId: string, deployment: ServiceDeployment): Promise<ServiceDeployment> {
    const serviceDeployment = await ServiceDeploymentSchema.findByIdAndUpdate(deploymentId, deployment, { new: true });
    return serviceDeployment;
  }

  async createServiceDeploymentsFromFlattenGraph(graph: FlattenGraph): Promise<any> {
    try {
      const serviceNodes = graph.graphNodes.filter((graphNode: any) => {
        return graphNode.node.type === NodeType.SERVICE_NODE;
      });

      const serviceDeployments = [] as ServiceDeployment[];
      serviceNodes.forEach((serviceNode: FlattenGraphNode) => {
        serviceNode.node.outputs.forEach((output: any) => {
          const targets = this.getOutputWithInputs(output, graph.connections, serviceNode);

          const serviceDeployment = {
            organization: graph.organization,
            service: serviceNode.node.service,
            outputName: output.name,
            outputId: output._id,
            targets
          } as ServiceDeployment;

          // For sub-service nodes
          if (serviceNode.specialReference) {
            serviceDeployment.specialReference = serviceNode.specialReference;
          }

          serviceDeployments.push(serviceDeployment);
        });
      });

      const queryForRemove = this.generateQueryForRemove(serviceNodes, graph.organization);
      await ServiceDeploymentSchema.deleteMany(queryForRemove);

      return await Promise.all(serviceDeployments.map( async (s) => await this.create(s)));
    } catch (err) {
      logger.error('[create service deployment from flatten]', err);
    }
  }

  generateQueryForRemove(serviceNodes: FlattenGraphNode[], organization: string) {
    const query = {} as any;
    query.$or = [] as any[];
    const serviceNodesWithoutSpecial = serviceNodes.filter((serviceNode: FlattenGraphNode) => !serviceNode.specialReference);
    const serviceNodesSpecial = serviceNodes.filter((serviceNode: FlattenGraphNode) => serviceNode.specialReference);
    const serviceIdsWithoutSpecial = serviceNodesWithoutSpecial.map((serviceNode: FlattenGraphNode) => serviceNode.node.service);

    if (serviceNodesWithoutSpecial.length) {
      query.$or.push({
        organization,
        // tslint:disable-next-line:no-null-keyword
        specialReference: { $eq: null },
        service: { $in: serviceIdsWithoutSpecial }
      });
    }

    serviceNodesSpecial.forEach((specialServiceNode: FlattenGraphNode) => {
      query.$or.push({
        organization,
        specialReference: specialServiceNode.specialReference,
        service: specialServiceNode.node.service
      });
    });
    return query;
  }

  getOutputWithInputs(output: any, connections: any[], serviceNode: FlattenGraphNode) {
    const serviceConnections = connections.filter((conn: any) => {
      return conn.source.output._id.toString() === output._id.toString();
    }).map(c => {
      const result = c.target as any;
      if (c.mappingNodeId && serviceNode.settings.mappingNodes) {
        result.mappingNode = serviceNode.settings.mappingNodes.find((mN: any) => mN._id.toString() === c.mappingNodeId.toString());
      }
      return result;
    });
    return serviceConnections;
  }

}
