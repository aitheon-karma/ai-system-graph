import { Type } from 'class-transformer';
import { IsArray, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, IsEnum } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Schema } from 'mongoose';
import { FunctionalNode, NodeVariables, nodeVariablesSchema } from '../nodes/node-functional.model';
import { ServiceNode } from '../nodes/node-service.model';
import { SocketPlacement } from '../nodes/node.model';
import { Device } from '../shared/device.model';
import '../shared/device.model';
import { Project } from '../shared/project-manager-project.model';
import { MappingNode } from './mapping-node.model';

export enum GraphNodeStatus {
  TERMINATED = 'TERMINATED',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
  RUNNING = 'RUNNING',
  SAVED = 'SAVED',
  CREATED = 'CREATED',
  RUNNING_ANOTHER_RELEASE = 'RUNNING_ANOTHER_RELEASE'
}

export namespace SubgraphNodeStatuses {
  export type SubgraphNodeStatusEnum = 'RUNNING' | 'PENDING' | 'STOPPED' | 'ERROR' | 'EMPTY' | 'INFO';
  export const SubgraphNodeStatusEnum = {
    RUNNING: 'RUNNING' as SubgraphNodeStatusEnum,
    PENDING: 'PENDING' as SubgraphNodeStatusEnum,
    STOPPED: 'STOPPED' as SubgraphNodeStatusEnum,
    ERROR: 'ERROR' as SubgraphNodeStatusEnum,
    EMPTY: 'EMPTY' as SubgraphNodeStatusEnum,
    INFO: 'INFO' as SubgraphNodeStatusEnum,
  };
}

@JSONSchema({ description: 'IO settings schema'})
export class IoSettings {
  @IsEnum(SocketPlacement)
  @IsNotEmpty()
  placement: SocketPlacement;

  @IsNotEmpty()
  @IsString()
  io: string;

  @IsNumber()
  order: number;
}

@JSONSchema({ description: 'Base Graph node schema'})
export class GraphNode {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  @IsNotEmpty()
  graphNodeName: string;

  @IsArray()
  @IsNumber({ each: true })
  position: Number[];

  // TODO: validate if the node has a Runtime.AOS type
  // @ValidateNested()
  @Type(() => Device)
  device: any;

  // For PM project
  @Type(() => Project)
  project: any;

  // For Job site project
  @Type(() => Project)
  jobSiteProject: any;

  @IsEnum(GraphNodeStatus)
  @IsOptional()
  status: GraphNodeStatus;

  @IsOptional()
  ref: any;

  @IsOptional()
  @IsArray()
  @Type(() => IoSettings)
  ioSettings: IoSettings[];

  // Only for client statuses

  @IsOptional()
  statuses: { [key: string]: number };
}

@JSONSchema({ description: 'Update UI element for applications'})
export class UpdateUIElements {

  @IsMongoId()
  graphNodeId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UIElement)
  uiElements: UIElement[];
}

@JSONSchema({ description: 'UI element for applications'})
export class UIElement {

  @IsString()
  id: string;

  // TODO remove this property when new applications flow will be ready
  @IsString()
  @IsOptional()
  type: string;

  @IsString()
  @IsOptional()
  widgetType: string;

  @IsNumber()
  cols: number;

  @IsNumber()
  rows: number;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional()
  meta: any;

  @IsString()
  @IsOptional()
  reference?: string;

}

@JSONSchema({ description: 'Functional Graph node schema'})
export class FunctionalGraphNode extends GraphNode {
  @ValidateNested()
  @Type(() => FunctionalNode)
  node: any;

  @ValidateNested()
  @Type(() => NodeVariables)
  instanceVariables: NodeVariables;

  @IsOptional()
  release: any;

  @IsOptional()
  isServiceSpecific: boolean;

  // For applications
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UIElement)
  uiElements: UIElement[];

  // Only for flattening
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingNode)
  mappingNodes: MappingNode[];
}

@JSONSchema({ description: 'Service Graph node schema'})
export class ServiceGraphNode extends GraphNode {
  @ValidateNested()
  @Type(() => ServiceNode)
  node: any;
}

@JSONSchema({ description: 'Subgraph Graph node schema'})
export class SubgraphGraphNode extends GraphNode {
  @IsOptional()
  graph: any;
}

export function isSubgraphGraphNode(graphNode: GraphNode): graphNode is SubgraphGraphNode {
  return (graphNode as SubgraphGraphNode).graph !== undefined;
}

/**
 * Database schema/collection
 */
const ioSettingsSchema = new Schema({
  placement: {
    type: String,
    enum: Object.keys(SocketPlacement),
  },
  io: String,
  order: Number,
});

export const uiElementSchema = new Schema({
  id: String,
  type: String,
  widgetType: String,
  cols: Number,
  rows: Number,
  x: Number,
  y: Number,
  meta: Schema.Types.Mixed,
  reference: String,
});

export const graphNodeSchema = new Schema({
  graphNodeName: {
    type: String,
  },
  node: {
    type: Schema.Types.ObjectId,
    ref: 'Node'
  },
  position: [Number],
  instanceVariables: nodeVariablesSchema,
  status: {
    type: String,
    enum: Object.keys(GraphNodeStatus),
    default: GraphNodeStatus.SAVED
  },
  device: {
    type: Schema.Types.ObjectId,
    ref: 'Device'
  },
  // reference to project-manager project
  project: {
    type: Schema.Types.ObjectId,
    ref: 'PMProject'
  },
  // reference to job-site project
  jobSiteProject: {
    type: Schema.Types.ObjectId,
    ref: 'JobSiteProject'
  },
  isServiceSpecific: {
    type: Boolean,
    default: false
  },
  ref: {
    type: Schema.Types.ObjectId,
    ref: 'Graph.graphNodes'
  },
  release: {
    type: Schema.Types.Mixed
  },
  ioSettings: [ioSettingsSchema],
  uiElements: [uiElementSchema]
});

export const subgraphNodeSchema = new Schema({
  graphNodeName: {
    type: String
  },
  graph: {
    type: Schema.Types.ObjectId,
    ref: 'Graph'
  },
  position: [Number],
  ioSettings: [ioSettingsSchema],
});
