import Db from '@aitheon/core-server/dist/config/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Document, Schema } from 'mongoose';
import { Socket } from '../sockets/socket.model';
import { NodeGroup, Runtime } from './node-group.model';

export enum NodeType {
  USER_NODE = 'USER_NODE',
  CORE_NODE = 'CORE_NODE',
  SERVICE_NODE = 'SERVICE_NODE',
  TEMPLATE_NODE = 'TEMPLATE_NODE',
  DEVICE_NODE = 'DEVICE_NODE',
  PROJECT_NODE = 'PROJECT_NODE',
}

export enum SocketPlacement {
  LEFT = 'LEFT',
  CENTER = 'CENTER',
  RIGHT = 'RIGHT',
}

export enum ChannelType {
  server = 'server',
  client = 'client',
}

@JSONSchema({ description: 'Socket metadata schema' })
export class SocketMetadata {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  name: string;

  @IsBoolean()
  multiple: boolean;

  @ValidateNested()
  @Type(() => Socket)
  socket: any;

  @IsString()
  @IsOptional()
  @IsIn(Object.keys(SocketPlacement))
  placement: string;

  @IsBoolean()
  @IsOptional()
  core: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => String)
  subgraphGroups: Array<string>;
}

@JSONSchema({ description: 'Channel metadata schema' })
export class ChannelMetadata extends SocketMetadata {
  @ValidateNested()
  @Type(() => Socket)
  responseSocket: any;

  @IsString()
  @IsIn(Object.keys(ChannelType))
  type: string;
}

@JSONSchema({ description: 'Base Node schema' })
export class Node {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  description: string;

  @ValidateNested()
  @Type(() => NodeGroup)
  group: any;

  @IsString()
  @IsIn([Runtime.AOS, Runtime.AOS_CLOUD, Runtime.AOS_EMBEDDED])
  runtime: string;

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

  // TODO: test validation here
  @ValidateIf(o => o.runtime === Runtime.AOS)
  @IsNotEmpty()
  // @ValidateNested()
  // @Type(() => DeviceType)
  deviceType: any;
}

export const socketMetadataSchema = new Schema({
  name: String,
  multiple: {
    type: Boolean,
    default: true
  },
  socket: {
    type: Schema.Types.ObjectId,
    ref: 'Socket'
  },
  placement: {
    type: String,
    enum: Object.keys(SocketPlacement),
  },
  core: {
    type: Boolean,
    default: false
  }
});

export const channelMetadataSchema = new Schema({
  name: String,
  multiple: {
    type: Boolean,
    default: true
  },
  socket: {
    type: Schema.Types.ObjectId,
    ref: 'Socket'
  },
  responseSocket: {
    type: Schema.Types.ObjectId,
    ref: 'Socket'
  },
  type: {
    type: String,
    enum: Object.keys(ChannelType),
  },
  placement: {
    type: String,
    enum: Object.keys(SocketPlacement),
  },
  core: {
    type: Boolean,
    default: false
  }
});

export const nodeSchema = new Schema({
  name: {
    type: String
  },

  type: {
    type: String,
    enum: Object.keys(NodeType),
    default: NodeType.CORE_NODE
  },

  description: String,

  group: {
    type: Schema.Types.ObjectId,
    ref: 'NodeGroup'
  },

  runtime: {
    type: String,
    enum: Object.keys(Runtime),
    default: Runtime.AOS_CLOUD
  },

  inputs: [socketMetadataSchema],
  outputs: [socketMetadataSchema],
  nodeChannels: [channelMetadataSchema],

  deviceType: {
    type: Schema.Types.ObjectId,
    ref: 'DeviceType'
  }
},
  {
    timestamps: true,
    collection: 'system_graph__nodes',
    discriminatorKey: 'kind'
  });

export type INode = Document & Node;
export const NodeSchema = Db.connection.model<INode>('Node', nodeSchema);
