import { SocketMetadata, ChannelMetadata } from '@aitheon/system-graph';
import { GraphNode } from './graph-node.model';

export interface NodeSettings {
  _id?: string;
  mapping: {
    enabled: boolean,
    propertyMaps: {
      source: string,
      target: string,
    }[],
  };
  ticks: {
    _id?: string,
    name: string,
    enabled: boolean,
    interval?: string,
  }[];
  parameters: {
    name: string,
    mandatory: boolean,
    _id?: string,
    value?: string,
  }[];
}

export class NodeData {
  constructor(
    public name: string,
    public settings: NodeSettings,
    public inference: {
      enabled: boolean,
      modelId: string,
    },
    public graphNode?: GraphNode,
    public _id?: string,
    public nodeChannels?: ChannelMetadata[],
    public inputs?: SocketMetadata[],
    public outputs?: SocketMetadata[],
    public subGraphIoType?: 'input' | 'output',
    public training?: {
      _id?: string,
      enabled: boolean,
      interval: number,
      consensusConfirmations: number,
      permissions: {
        owner: boolean,
        admin: boolean,
        user: boolean,
        specialist: boolean,
      },
    },
    public service?: string,
    public description?: string,
    public type?: string,
    public reference?: string,
    public  runtimeParameters?: {
      module: string,
      type: string,
      build: {
        module: string,
        dependencies: any[];
      },
    },
    public graph?: string,
    public isLatest?: boolean,
    public project?: any,
    public release?: string,
    public status?: string,
    public disabled?: boolean,
    public templateName?: string,
    public templateVariables?: any,
    public core?: boolean,
    public device?: any,
    public subType?: string,
    public storeRequest?: {
      [key: string]: any,
      nodeStyling?: {
        logo: any,
        borderColor: string,
        backgroundColor: string,
      }
    },
    public statuses?: any,
    public requested?: boolean,
  ) {}
}

export class NodeModel {
  constructor(
    public id: string,
    public name: string,
    public data: NodeData,
    public inputs: any,
    public outputs: any,
    public position: number[],
    public meta?: any,
    public statuses?: any
  ) {}
}
