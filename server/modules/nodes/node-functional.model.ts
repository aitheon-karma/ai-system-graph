import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
  IsEnum,
  IsDateString
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Document, Schema } from 'mongoose';
import { Node, NodeSchema, NodeType } from './node.model';

@JSONSchema({ description: 'Runtime build schema' })
export class RuntimeBuild {
  @IsString()
  @IsNotEmpty()
  module: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => String)
  dependencies: string[];
}

@JSONSchema({ description: 'Runtime parameters schema' })
export class RuntimeParameters {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  module: string;

  @IsString()
  type: string;

  @ValidateNested()
  @Type(() => RuntimeBuild)
  build: RuntimeBuild;
}

@JSONSchema({ description: 'Training node permissions schema' })
class TrainingPermissions {
  @IsBoolean()
  owner: Boolean;
  @IsBoolean()
  admin: Boolean;
  @IsBoolean()
  user: Boolean;
  @IsBoolean()
  specialist: Boolean;
}

@JSONSchema({ description: 'Training node schema' })
export class Training {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsBoolean()
  enabled: Boolean;

  @IsNumber()
  interval: Number;

  @IsNumber()
  consensusConfirmations: Number;

  @ValidateNested()
  @Type(() => TrainingPermissions)
  permissions: TrainingPermissions;
}

@JSONSchema({ description: 'Node settings mapping property schema' })
export class MappingProperty {
  @IsString() source: string;
  @IsString() target: string;
}

@JSONSchema({ description: 'Node settings mapping schema' })
export class NodeSettingsMapping {
  @IsBoolean() enabled: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingProperty)
  propertyMaps: MappingProperty[];
}

@JSONSchema({ description: 'Node settings tick schema' })
export class NodeSettingsTick {
  @IsBoolean()
  enabled: boolean;

  // TODO: update class-validator
  @ValidateIf(o => o.enabled)
  @IsString()
  @IsNotEmpty()
  interval: string;

  @IsString()
  name: string;
}

@JSONSchema({ description: 'Node settings parameter schema' })
export class Parameter {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  mandatory: boolean;

  @ValidateIf(o => o.mandatory)
  @IsNotEmpty()
  value: any;
}

@JSONSchema({ description: 'Node settings schema' })
export class NodeSettings {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @ValidateNested()
  @Type(() => NodeSettingsMapping)
  mapping: NodeSettingsMapping;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeSettingsTick)
  ticks: NodeSettingsTick[];

  @ValidateNested({ each: true })
  @Type(() => Parameter)
  parameters: Parameter[];
}

@JSONSchema({ description: 'Node inference schema' })
export class Inference {

  @IsMongoId()
  @IsOptional()
  modelId: string;

  @IsBoolean()
  enabled: boolean;
}

@JSONSchema({ description: 'Node variables schema' })
export class NodeVariables {

  @ValidateNested()
  @Type(() => Inference)
  inference: Inference;

  @ValidateNested()
  @Type(() => Training)
  training: Training;

  @ValidateNested()
  @Type(() => NodeSettings)
  settings: NodeSettings;
}

@JSONSchema({ description: 'Functional Node schema' })
export class FunctionalNode extends Node {
  @IsMongoId()
  @IsOptional()
  project: any;

  @ValidateNested()
  @Type(() => RuntimeParameters)
  runtimeParameters: RuntimeParameters;

  @IsOptional()
  @ValidateNested()
  @Type(() => NodeVariables)
  templateVariables: NodeVariables;
}

export function isFunctionalNode(node: Node): node is FunctionalNode {
  return (node as FunctionalNode).type === NodeType.CORE_NODE ||
    (node as FunctionalNode).type === NodeType.USER_NODE ||
    (node as FunctionalNode).type === NodeType.TEMPLATE_NODE;
}

/**
 * Database schema/collection
 */
const trainingSchema = new Schema({
  enabled: Boolean,
  interval: Number,
  consensusConfirmations: Number,
  permissions: {
    owner: Boolean,
    admin: Boolean,
    user: Boolean,
    specialist: Boolean,
  }
});

const runtimeParametersSchema = new Schema({
  module: String,
  type: String,
  build: {
    module: String,
    dependencies: [String]
  }
});

const nodeSettingsSchema = new Schema({
  mapping: {
    enabled: Boolean,
    propertyMaps: [{
      source: String,
      target: String,
    }],
  },
  ticks: [{
    name: String,
    enabled: {
      type: Boolean,
      default: true
    },
    interval: String,
  }],
  parameters: [{
    name: String,
    mandatory: Boolean,
    value: Schema.Types.Mixed,
  }],
});

// Export to reuse in the graph-model
export const nodeVariablesSchema = new Schema({
  inference: {
    modelId: Schema.Types.ObjectId,
    enabled: Boolean
  },
  training: trainingSchema,
  settings: nodeSettingsSchema
});


const functionalNodeSchema = new Schema({
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  runtimeParameters: runtimeParametersSchema
});

export type IFunctionalNode = Document & FunctionalNode;
export const FunctionalNodeSchema = NodeSchema.discriminator<IFunctionalNode>('FunctionalNode', functionalNodeSchema);
