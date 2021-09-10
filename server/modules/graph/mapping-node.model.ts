import { Schema } from 'mongoose';
import { SocketMetadata, socketMetadataSchema } from '../nodes/node.model';
import { Type } from 'class-transformer';
import { IsArray, IsMongoId, IsNumber, IsOptional, IsString, IsDefined } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({ description: 'Mapping schema' })
export class Mapping {
  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsOptional()
  defaultValue: any;
}

@JSONSchema({ description: 'Predefined element schema' })
export class PredefinedElement {
  @IsString()
  to: string;

  @IsDefined()
  value: any;
}

@JSONSchema({ description: 'Mapping node schema'})
export class MappingNode {
  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsArray()
  @IsNumber({ each: true })
  position: Number[];

  @Type(() => SocketMetadata)
  input: SocketMetadata;

  @Type(() => SocketMetadata)
  output: SocketMetadata;

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

export const mappingNodeSchema = new Schema({
  position: [Number],
  input: socketMetadataSchema,
  output: socketMetadataSchema,
  mapping: [{
    from: String,
    to: String,
    defaultValue: Schema.Types.Mixed,
  }],
  staticFields: [{
    to: String,
    value: Schema.Types.Mixed,
  }],
  customFields: [{
    to: String,
    value: Schema.Types.Mixed,
  }],
});
