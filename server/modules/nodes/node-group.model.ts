import Db from '@aitheon/core-server/dist/config/db';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional, IsString, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Document, Schema } from 'mongoose';
import { RuntimeBuild } from './node-functional.model';

export enum Runtime {
  AOS = 'AOS',
  AOS_EMBEDDED = 'AOS_EMBEDDED',
  AOS_CLOUD = 'AOS_CLOUD'
}

@JSONSchema({ description: 'Node group schema' })
export class NodeGroup {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  // TODO: validate it contains runtime valid values only
  @ValidateNested({ each: true })
  @Type(() => String)
  runtimes: string[];
}

// TODO
@JSONSchema({ description: 'Functional Node group schema' })
export class FunctionalNodeGroup extends NodeGroup {
  build: RuntimeBuild;
}


/**
 * Database schema/collection
 */
const nodeGroupSchema = new Schema({
  name: String,
  description: String,
  runtimes: [{
    type: String,
    enum: Object.keys(Runtime),
    default: Runtime.AOS
  }]
},
  {
    timestamps: true,
    collection: 'system_graph__node_groups'
  });

export type INodeGroup = Document & NodeGroup;
export const NodeGroupSchema = Db.connection.model<INodeGroup>('NodeGroup', nodeGroupSchema);
