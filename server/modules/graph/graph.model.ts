import Db from '@aitheon/core-server/dist/config/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
  IsDefined
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Document, Schema } from 'mongoose';
import { Runtime } from '../nodes/node-group.model';
import { ChannelMetadata, channelMetadataSchema, SocketMetadata, socketMetadataSchema } from '../nodes/node.model';
import '../shared/project.model';
import '../shared/models/file-item.model';
import {
  FunctionalGraphNode,
  graphNodeSchema,
  ServiceGraphNode,
  SubgraphGraphNode,
  subgraphNodeSchema,
} from './graph-nodes.model';
import '../shared/device.model';
import { Device } from '../shared/device.model';
import { MappingNode, mappingNodeSchema } from './mapping-node.model';
import { FileItem, fileItemSchema } from '../shared/models/file-item.model';

export enum GraphType {
  ORGANIZATION = 'ORGANIZATION',
  SERVICE = 'SERVICE',
  SUBGRAPH = 'SUBGRAPH',
  TEMPLATE = 'TEMPLATE',
  LINKED = 'LINKED',
  CORE = 'CORE'
}

export enum GraphSubType {
  SERVICE = 'SERVICE',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  FLOOR = 'FLOOR',
  STATION = 'STATION',
  CONTROLLER = 'CONTROLLER',
  SITE = 'SITE',
  // For special sub graphs with service node based on project, infrastructure etc..
  SPECIAL = 'SPECIAL'
}

export enum GraphRefType {
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  FLOOR = 'FLOOR',
  STATION = 'STATION',
  SERVICE = 'SERVICE',
  CONTROLLER = 'CONTROLLER',
  SPECIAL = 'SPECIAL'
}

export enum SpecialServiceType {
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  JOB_SITE = 'JOB_SITE',
  SMART_INFRASTRUCTURE = 'SMART_INFRASTRUCTURE'
}

export enum ConnectionType {
  NODE = 'NODE',
  INTERFACE = 'INTERFACE',
  SUBGRAPH = 'SUBGRAPH',
  MAPPING = 'MAPPING',
}

export enum IoEntryPoint {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum InformationNodeType {
  TEXTAREA = 'TEXTAREA',
  IMAGE = 'IMAGE',
}

export enum GraphStatus {
  PENDING = 'PENDING',
  TERMINATED = 'TERMINATED',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
  SAVED = 'SAVED'
}

export enum InteractionType {
  EVENT = 'EVENT',
  CHANNEL = 'CHANNEL',
}

@JSONSchema({ description: 'Deploy graph node' })
export class DeployNode {

  @IsString()
  graphNodeId: string;

  @IsOptional()
  @IsBoolean()
  publish: boolean;

  @IsOptional()
  @IsBoolean()
  updateToLatestRelease: boolean;

}


@JSONSchema({ description: 'Adding devices to a subgraph' })
export class DevicesToSubgraph {

  // device
  @ValidateNested()
  @Type(() => Device)
  device: Device;

  // Reference of a subgraph to add
  @IsString()
  reference: string;

}

@JSONSchema({ description: 'Adding controller to a subgraph' })
export class ControllerToSubgraph {

  // Controller
  @ValidateNested()
  @Type(() => Device)
  controller: Device;

  // List of linked devices
  @ValidateNested({ each: true })
  @Type(() => Device)
  devices: Device[];

  // Reference of a subgraph to add
  @IsString()
  reference: string;

}

@JSONSchema({ description: 'Removing devices from station' })
export class DevicesFromStation {

  @IsString()
  controllerId: string;

  @IsString()
  stationId: string;

  @IsString()
  infrastructureId: string;

}

@JSONSchema({ description: 'Removing constollre from org' })
export class ControllerFromOrg {

  @IsString()
  controllerId: string;

  @IsString()
  reference: string;

}

@JSONSchema({ description: 'Removing devices from infra to station' })
export class DevicesFromInfrastructure {

  @IsArray()
  devices: string[];

  @IsString()
  infrastructure: string;

}

@JSONSchema({ description: 'Adding/removing subgraph to infrastructure' })
export class DriverToController {

  @IsDefined()
  device: any;

  @IsOptional()
  @IsString()
  projectId: string;

  // reference for subGraph on what device is
  @IsOptional()
  @IsString()
  reference: string;

}

@JSONSchema({ description: 'Remove application' })
export class RemoveApplication {

  @IsMongoId()
  graphNodeId: string;

}

@JSONSchema({ description: 'Remove device' })
export class RemoveDevice {

  @IsMongoId()
  device: string;

  @IsEnum(GraphSubType)
  subType: GraphSubType;

  @IsString()
  reference: string;

  @IsOptional()
  @IsString()
  infrastructure: string;

}

@JSONSchema({ description: 'SubGraph creation body' })
export class SubgraphCreation {

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  reference: string;

  // Id of infrastructure, to get infrastructure subgraph
  @IsOptional()
  @IsString()
  infrastructure: string;

  @IsOptional()
  controller: Device;

  @IsOptional()
  @IsBoolean()
  isNewController: boolean;

}

@JSONSchema({ description: 'SubGraph creation by reference body' })
export class SubgraphCreationByRef {

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  reference: string;

  @IsEnum(GraphSubType)
  subType: GraphSubType;

  @IsOptional()
  @IsString()
  parentReference: string;

}

@JSONSchema({ description: 'Special SubGraph creation body' })
export class SpecialSubgraphCreation {

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  reference: string;

  @IsOptional()
  @IsEnum(SpecialServiceType)
  service: SpecialServiceType;

}

@JSONSchema({ description: 'Socket junction point schema' })
export class SocketJunctionPoint {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  @IsOptional()
  @IsIn([IoEntryPoint.LEFT, IoEntryPoint.RIGHT])
  entryPoint: string;

  @IsMongoId()
  @IsString()
  graphNodeId: string;

  @IsMongoId()
  @IsString()
  socketMetadataId: string;

  @IsString()
  @IsIn([ConnectionType.NODE, ConnectionType.INTERFACE, ConnectionType.SUBGRAPH])
  type: string;
}

@JSONSchema({ description: 'Connection pin schema' })
export class ConnectionPin {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

@JSONSchema({ description: 'Graph connection schema' })
export class GraphConnection {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.keys(InteractionType))
  type: string;

  @ValidateNested()
  @Type(() => SocketJunctionPoint)
  source: SocketJunctionPoint;

  @ValidateNested()
  @Type(() => SocketJunctionPoint)
  target: SocketJunctionPoint;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConnectionPin)
  pins: ConnectionPin[];

  @IsOptional()
  @IsMongoId()
  mappingNodeId: String;
}

@JSONSchema({ description: 'Information graph node schema' })
export class InformationGraphNode {
  @IsOptional()
  name: string;

  @IsOptional()
  text: string;

  @IsString()
  @IsIn([InformationNodeType.IMAGE, InformationNodeType.TEXTAREA])
  type: string;

  @IsArray()
  @IsNumber({ each: true })
  position: Number[];

  @IsArray()
  @IsNumber({ each: true })
  size: Number[];

  @IsOptional()
  @Type(() => FileItem)
  @ValidateNested()
  image: FileItem;
}

@JSONSchema({ description: 'Graph schema' })
export class Graph {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  organization: any;

  @IsString()
  @IsIn([GraphType.ORGANIZATION, GraphType.SERVICE, GraphType.SUBGRAPH])
  type: string;

  @IsString()
  @IsEnum(GraphSubType)
  subType: string;

  @IsOptional()
  @IsMongoId()
  reference: string;

  @IsString()
  @IsIn([Runtime.AOS, Runtime.AOS_CLOUD, Runtime.AOS_EMBEDDED])
  runtime: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunctionalGraphNode)
  graphNodes: FunctionalGraphNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubgraphGraphNode)
  subgraphNodes: SubgraphGraphNode[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InformationGraphNode)
  informationNodes: InformationGraphNode[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MappingNode)
  mappingNodes: MappingNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphConnection)
  connections: GraphConnection[];

  @IsOptional()
  createdBy: any;

  @IsOptional()
  item: any;

  // From mongoose-mpath plugin
  @IsOptional()
  @IsString()
  path: any;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocketMetadata)
  inputs: SocketMetadata[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocketMetadata)
  outputs: SocketMetadata[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelMetadata)
  nodeChannels: ChannelMetadata[];

  @IsOptional()
  @IsEnum(GraphStatus)
  status: string;

  @ValidateNested()
  @Type(() => Graph)
  parent: string;

  @IsBoolean()
  core: boolean;

  // Dummy: for API
  @IsOptional()
  @IsArray()
  breadcrumbs: any[];

  @IsBoolean()
  disabled: boolean;
}

@JSONSchema({ description: 'Service Graph schema' })
export class ServiceGraph extends Graph {

  @ValidateNested()
  @Type(() => ServiceGraphNode)
  serviceGraphNode: ServiceGraphNode;

  @IsString()
  service: string;

}

@JSONSchema({ description: 'Linked Graph schema' })
export class LinkedGraph extends Graph {

  @ValidateNested()
  @Type(() => Graph)
  ref: Graph;

}

@JSONSchema({description: 'Add nodes to sub-graph schema'})
export class AddNodesToSubgraphSchema {

  @IsString({each: true})
  projects: string[];

  @IsOptional()
  @IsString()
  deviceId: string;
}

@JSONSchema({description: 'Add automation'})
export class AddAutomation {

  @IsString()
  projectId: string;

  @IsEnum(GraphRefType)
  referenceType: GraphRefType;

  @IsString()
  reference: string;

}

/**
 * Database schema/collection
 */
const connectionPinSchema = new Schema({
  x: Number,
  y: Number,
});

const graphConnectionSchema = new Schema({
  type: {
    type: String,
    enum: Object.keys(InteractionType),
    default: InteractionType.EVENT,
  },
  source: {
    graphNodeId: {
      type: Schema.Types.ObjectId,
      ref: 'Graph.graphNodes'
    },
    socketMetadataId: {
      type: Schema.Types.ObjectId,
      ref: 'Graph.graphNodes.node.outputs'
    },
    type: {
      type: String,
      enum: Object.keys(ConnectionType),
      default: ConnectionType.NODE,
    },
    entryPoint: String,
  },
  target: {
    graphNodeId: {
      type: Schema.Types.ObjectId,
      ref: 'Graph.graphNodes'
    },
    socketMetadataId: {
      type: Schema.Types.ObjectId,
      ref: 'Graph.graphNodes.node.inputs'
    },
    type: {
      type: String,
      enum: Object.keys(ConnectionType),
      default: ConnectionType.NODE,
    },
    entryPoint: String,
  },
  pins: [connectionPinSchema],
});

const informationGraphNodeSchema = new Schema({
  name: String,
  text: String,
  position: [Number],
  size: [Number],
  image: fileItemSchema,
  type: {
    type: String,
    enum: Object.keys(InformationNodeType),
  },
});

const graphSchema = new Schema({
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization'
    },
    name: String,
    type: {
      type: String,
      enum: Object.keys(GraphType),
      default: GraphType.SERVICE
    },
    subType: {
      type: String,
      enum: Object.keys(GraphSubType)
    },
    // Reference to a collection from subtype: Infrastructure, Floor, Station, Controller
    reference: {
      type: Schema.Types.ObjectId
    },
    runtime: {
      type: String,
      enum: Object.keys(Runtime),
      default: Runtime.AOS
    },
    createdBy: Schema.Types.ObjectId,
    graphNodes: [graphNodeSchema],
    subgraphNodes: [subgraphNodeSchema],
    informationNodes: [informationGraphNodeSchema],
    mappingNodes: [mappingNodeSchema],
    connections: [graphConnectionSchema],
    item: Schema.Types.ObjectId,
    inputs: [socketMetadataSchema],
    outputs: [socketMetadataSchema],
    nodeChannels: [channelMetadataSchema],
    status: {
      type: String,
      enum: Object.keys(GraphStatus)
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Graph'
    },
    core: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    collection: 'system_graph__graphs',
    discriminatorKey: 'kind'
  });

const serviceGraphSchema = new Schema({
  serviceGraphNode: graphNodeSchema,
  service: String
});

const linkedGraphSchema = new Schema({
  ref: {
    type: Schema.Types.ObjectId,
    ref: 'Graph'
  }
});

export type IGraph = Document & Graph;
export const GraphSchema = Db.connection.model<IGraph>('Graph', graphSchema);

export type IServiceGraph = Document & ServiceGraph;
export const ServiceGraphSchema = GraphSchema.discriminator<IServiceGraph>('ServiceGraph', serviceGraphSchema);

export type ILinkedGraph = Document & LinkedGraph;
export const LinkedGraphSchema = GraphSchema.discriminator<ILinkedGraph>('LinkedGraph', linkedGraphSchema);
