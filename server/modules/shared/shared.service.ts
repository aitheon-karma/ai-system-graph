import { Service as TypediService, Inject } from 'typedi';
import Db from '@aitheon/core-server/dist/config/db';
import { Service } from './interfaces';
import { Graph } from '../graph/graph.model';


export const SERVICE_IGNORE_LIST = ['AUTH', 'ADMIN', 'LANDING', 'TEMPLATE', 'APP_SERVER', 'BUILD_SERVER', 'UTILITIES', 'PLATFORM_SUPPORT'];

export const DEFAULT_DEVICE_POPULATION = {
  path: 'graphNodes.device',
  select: '_id name online serialNumber aosToken type',
  populate: {
    path: 'type'
  }
};

export const DEFAULT_PROJECT_NODE_POPULATION = {
  path: 'graphNodes.node',
  select: '-templateVariables',
  populate: {
    path: 'project'
  }
};

@TypediService()
export class SharedService {

  constructor() {}

  async getOrganizationCoreServices() {
    return new Promise((resolve, reject) => {
        const query =  Db.connection.collection('services').find({core: true, serviceType: {$in: ['organization', 'any']}, envStatus: 'PROD', _id: {$nin: SERVICE_IGNORE_LIST} });
        const services: Service[] = [];
        query.on('data', (data: Service) => services.push(data));
        query.on('error', (err) => reject(err));
        query.on('end', () => resolve(services));
    });
  }

  async getCoreServiceById(serviceId: string): Promise<Service[]> {
    return new Promise((resolve, reject) => {
      const query =  Db.connection.collection('services').find({_id: serviceId, core: true});
      const services: Service[] = [];
      query.on('data', (data: Service) => services.push(data));
      query.on('error', (err) => reject(err));
      query.on('end', () => resolve(services));
    });
  }

  getUniqueName(graph: Graph, name: string) {
    const elements = [...graph.graphNodes, ...graph.subgraphNodes, ...graph.informationNodes];
    const isNotUnique = elements.some((gNode: any) => gNode.graphNodeName === name);
    if (isNotUnique) {
      name = this.generateUniqueName(name, elements, 1);
    }
    return name;
  }

  generateUniqueName(name: string, elements: any[], index: number): any {
    const isNotUnique = elements.some((gNode: any) => gNode.graphNodeName === `${name} ${index}`);
    if (!isNotUnique) {
      return `${name} ${index}`;
    } else {
      index++;
      return this.generateUniqueName(name, elements, index);
    }
  }

}
