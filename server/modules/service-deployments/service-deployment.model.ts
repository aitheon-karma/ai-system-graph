import Db from '@aitheon/core-server/dist/config/db';
import { IsMongoId, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Document, Schema } from 'mongoose';
import { SocketMetadata, socketMetadataSchema } from '../nodes/node.model';
import { Type } from 'class-transformer';
import { FlattenMappingNode } from '../graph/flatten-graph.model';


@JSONSchema({ description: 'Service Deployment target schema' })
export class ServiceDeploymentTarget {

  @IsString()
  graphNode: string;

  @Type(() => SocketMetadata)
  input: SocketMetadata;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlattenMappingNode)
  mappingNode: FlattenMappingNode;

}

@JSONSchema({ description: 'Service Deployment schema' })
export class ServiceDeployment {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsMongoId()
  organization: string;

  @IsString()
  service: string;

  @IsString()
  outputName: string;

  @IsMongoId()
  outputId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDeploymentTarget)
  targets: ServiceDeploymentTarget[];

  @IsOptional()
  @IsMongoId()
  specialReference: string;

}


const mappingNodeSchema = new Schema({
  mapping: [{
    from: String,
    to: String,
    default: Schema.Types.Mixed
  }],
  staticFields: [{
    to: String,
    value: Schema.Types.Mixed
  }],
  customFields: [{
    to: String,
    value: Schema.Types.Mixed
  }]
});

/**
 * Database schema/collection
 */
const serviceDeploymentSchema = new Schema({
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  service: String,
  outputName: String,
  outputId: String,
  targets: [
    {
      graphNode: String,
      input: socketMetadataSchema,
      mappingNode: mappingNodeSchema
    }],
  specialReference: {
    type: Schema.Types.ObjectId
  }
},
  {
    timestamps: true,
    collection: 'system_graph__service_deployments'
  });

export type IServiceDeployment = Document & ServiceDeployment;
export const ServiceDeploymentSchema = Db.connection.model<IServiceDeployment>('ServiceDeployment', serviceDeploymentSchema);
