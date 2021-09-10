import { Schema, Document } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsMongoId, IsOptional, IsBoolean } from 'class-validator';

@JSONSchema({ description: 'Bot' })
export class Bot {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  username: string;

  @IsMongoId()
  @IsOptional()
  organization: string;

  @IsBoolean()
  @IsOptional()
  isDeleted: boolean;

  @IsString()
  @IsOptional()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName: string;

  @IsString()
  description?: string;

}

const botSchema = new Schema({

  username: {
    type: String,
    required: true
  },

  organization: {
    type: Schema.Types.ObjectId,
    required: true
  },

  isDeleted: {
    type: Boolean,
    default: false,
    required: true
  },

  firstName: {
    type: String
  },

  lastName: {
    type: String,
    default: 'Bot'
  },

  description: {
    type: String,
    default: ''
  },

}, {
  collection: 'communications__bots',
  timestamps: true
});

export type IBot = Document & Bot;
export const BotSchema = Db.connection.model<IBot>('Bot', botSchema);
