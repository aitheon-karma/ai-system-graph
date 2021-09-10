import { JSONSchema } from 'class-validator-jsonschema';
import {
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { Schema } from 'mongoose';

@JSONSchema({ description: 'File schema' })
export class FileItem {

  @IsOptional()
  @IsMongoId()
  _id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  contentType: string;

  @IsOptional()
  @IsString()
  signedUrl: string;
}

export const fileItemSchema = new Schema({
    signedUrl: String,
    name: String,
    contentType: String,
});
