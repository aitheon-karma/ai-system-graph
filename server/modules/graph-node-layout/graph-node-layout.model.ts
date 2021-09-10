import Db from '@aitheon/core-server/dist/config/db';
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
import { UIElement, uiElementSchema } from '../graph/graph-nodes.model';
import { Document, Schema } from 'mongoose';
import { Type } from 'class-transformer';


@JSONSchema({ description: 'Flatten junction' })
export class GraphNodeLayout {

  @IsMongoId()
  _id: string;

  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsMongoId()
  node: string;

  @IsMongoId()
  @IsOptional()
  graphNodeId: string;

  @IsMongoId()
  projectId: string;

  @IsNumber()
  height: number;

  @IsNumber()
  width: number;

  @IsMongoId()
  @IsOptional()
  user: string;

  @IsMongoId()
  @IsOptional()
  organization: string;

  @IsBoolean()
  @IsOptional()
  main: boolean;

  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => UIElement)
  elements: UIElement[];

  @IsOptional()
  meta?: any;

  @IsMongoId()
  @IsOptional()
  reference: string;
}


export const graphNodeLayoutSchema = new Schema({
  type: {
    type: String
  },
  name: {
    type: String
  },
  node: {
    type: Schema.Types.ObjectId,
  },

  graphNodeId: {
    type: Schema.Types.ObjectId
  },

  projectId: {
    type: Schema.Types.ObjectId,
  },

  height: Number,

  width: Number,

  organization: Schema.Types.ObjectId,

  user: Schema.Types.ObjectId,

  main: Boolean,

  elements: [uiElementSchema]
},
  {
    timestamps: true,
    collection: 'system_graph__nodes_layouts'
  });

export type IGraphNodeLayout = Document & GraphNodeLayout;
export const GraphNodeLayoutSchema = Db.connection.model<IGraphNodeLayout>('GraphNodeLayout', graphNodeLayoutSchema);
