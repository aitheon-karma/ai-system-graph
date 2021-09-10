import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsOptional, IsArray, ValidateNested, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { Project } from '@aitheon/creators-studio-server';
import { Mapping, PredefinedElement } from './mapping-node.model';


@JSONSchema({ description: 'Flatten junction' })
export class FlattenJunctionPoint {

  @IsMongoId()
  _id: string;

  @IsString()
  name: string;

  @IsString()
  socket: string;
}

@JSONSchema({ description: 'Flatten graph node' })
export class FlattenSource {

  @IsString()
  graphNode: String;   // ID of a GraphNode

  @ValidateNested()
  @Type(() => FlattenJunctionPoint)
  output: FlattenJunctionPoint;
}

@JSONSchema({ description: 'Flatten graph node' })
export class FlattenTarget {

  @IsString()
  graphNode: String;   // ID of a GraphNode

  @ValidateNested()
  @Type(() => FlattenJunctionPoint)
  input: FlattenJunctionPoint;      // ID of a node input

}

@JSONSchema({ description: 'Flatten graph node' })
export class FlattenNode {

  @IsMongoId()
  _id: String;

  @IsString()
  name: string;

  @IsString()
  type: string;   // SERVICE or COMPUTE

  @IsString()
  runtime: string;

  @ValidateNested()
  @Type(() => Project)
  project: Project; // Project (only for Compute Node)

  @IsMongoId()
  release: string; // Release ID (only for Compute Node)

  @IsString()
  service: string; // Service ID (only for Service Node)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlattenJunctionPoint)
  inputs: [FlattenJunctionPoint];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlattenJunctionPoint)
  outputs: [FlattenJunctionPoint];

}

@JSONSchema({ description: 'Flatten graph node' })
export class FlattenGraphNode {

  @IsMongoId()
  _id: String;

  @IsMongoId()
  graphId: String;

  @ValidateNested()
  @Type(() => FlattenNode)
  node: FlattenNode;           // a Node(template) from Db

  @IsOptional()
  device?: any;

  @IsOptional()
  specialReference?: any;

  // TO_DO: define model later
  @IsOptional()
  settings: any;

}

@JSONSchema({ description: 'Flatten mapping node' })
export class FlattenMappingNode {

  @IsMongoId()
  _id: String;


  @IsArray()
  @Type(() => Mapping)
  mapping: Mapping[];


  @IsArray()
  @IsOptional()
  @Type(() => PredefinedElement)
  staticFields: PredefinedElement[];

  @IsArray()
  @IsOptional()
  @Type(() => PredefinedElement)
  customFields: PredefinedElement[];

}

@JSONSchema({ description: 'Flatten graph connection' })
export class FlattenConnection {

  @IsString()
  type: string;

  @ValidateNested()
  @Type(() => FlattenSource)
  source: FlattenSource;

  @ValidateNested()
  @Type(() => FlattenTarget)
  target: FlattenTarget;

  @IsOptional()
  @IsMongoId()
  mappingNodeId?: String;

}

@JSONSchema({ description: 'Flatten graph' })
export class FlattenGraph {

  @IsString()
  organization: string;

  @IsOptional()
  @IsString()
  graphId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlattenGraphNode)
  graphNodes: [FlattenGraphNode];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlattenConnection)
  connections: [FlattenConnection];

}
