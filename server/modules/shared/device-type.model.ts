import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsDate, IsDefined, IsOptional, Min, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';


@JSONSchema({ description: 'Device type model' })
export class DeviceType {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsArray()
  commands: any[];

  @IsOptional()
  @IsString()
  defaultIcon: string;

  @IsOptional()
  defaultDriver: any;

  @IsOptional()
  createdBy: any;

  @IsOptional()
  updatedBy: any;
}


/**
 * Database schema/collection
 */
const deviceTypeSchema = new Schema({
  name: String,
  description: String,
  // NC Commands available for this device type
  commands: [{
    type: Schema.Types.ObjectId,
    ref: 'NcCommand'
  }],
  // Default image for all devices of this type to show if not uploaded for a device
  defaultIcon: String,
  // Default driver for all devices of this type if specific for a device
  defaultDriver: {
    type: Schema.Types.ObjectId
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
},
{
  timestamps: true,
  collection: 'device_manager__device-type'
});

export type IDeviceType = Document & DeviceType;
export const DeviceTypeSchema = Db.connection.model<IDeviceType>('DeviceType', deviceTypeSchema);
