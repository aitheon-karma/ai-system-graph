import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import {
  IsString,
  IsMongoId,
  IsOptional,
  IsDefined,
  ValidateNested,
  IsInt,
  IsNumber,
  IsBoolean,
  IsEnum
} from 'class-validator';
import { Type } from 'class-transformer';
import './device-type.model';

export enum DeviceSubType {
  TAG = 'TAG',
  CAMERA = 'CAMERA',
  SCALE = 'SCALE',
  ANCHOR = 'ANCHOR',
  PRINTER = 'PRINTER',
  READER = 'READER',
  ROBOT = 'ROBOT',
  VR_DEVICE = 'VR_DEVICE',
  AOS_DEVICE = 'AOS_DEVICE',
}

@JSONSchema({ description: 'Translation model' })
export class Translation {

  @IsInt()
  x: number;

  @IsInt()
  y: number;

}

@JSONSchema({ description: 'Device filter' })
export class DeviceFilter {

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString({ each: true })
  types: string[];

  @IsOptional()
  @IsString({ each: true })
  subType: string[];

  @IsOptional()
  @IsString({ each: true })
  drivers: string[];

  @IsOptional()
  @IsString({ each: true })
  statuses: string[];

  @IsOptional()
  @IsString()
  infrastructure: string;

  @IsOptional()
  @IsString({ each: true })
  floors: string[];

  @IsOptional()
  @IsString()
  area: string;

  @IsOptional()
  @IsString({ each: true })
  models: string[];

}

@JSONSchema({ description: 'Device summary schema' })
export class DeviceSummary {

  @IsMongoId()
  @IsDefined()
  deviceId: string;
}

export enum CommunicationType {
  WIFI = 'WIFI',
  USB = 'USB',
  ETHERNET = 'ETHERNET',
  SERIAL = 'SERIAL',
}

export enum ProtocolType {
  ZPL = 'ZPL',
  HID = 'HID',
  SERIAL = 'SERIAL'
}

@JSONSchema({ description: 'Device schema' })
export class Device {

  @IsMongoId()
  _id: any;

  @IsString()
  name: string;

  @IsDefined()
  type: any;

  // Temporary quick decision, need to rework
  @IsEnum(DeviceSubType)
  subType: string;

  @IsString()
  serialNumber: string;

  @IsDefined()
  organization: string;

  @IsDefined()
  defaultTask: any;

  @IsDefined()
  infrastructure: any;

  @IsDefined()
  currentTask: any;

  @IsDefined()
  system: any;

  @IsDefined()
  model: any;

  @IsDefined()
  driver: any;

  @IsString()
  status: string;

  @IsInt()
  batteryHealth: number;

  @IsOptional()
  image: any;

  @ValidateNested()
  @Type(() => Device)
  controller: Device;

  @IsString()
  address: string;

  @IsString()
  port: string;

  @IsOptional()
  chargingStation: any;

  @IsDefined()
  floor: any;

  @IsOptional()
  area: any;

  @IsOptional()
  createdBy: any;

  @IsOptional()
  updatedBy: any;

  @IsOptional()
  taskFloor: any;

  @IsOptional()
  @IsString()
  pid: string;

  @IsOptional()
  @IsString()
  path: string;

  @IsOptional()
  @IsString()
  manufacturer: string;

  @IsOptional()
  @IsString()
  product: string;

  @IsOptional()
  @IsEnum(CommunicationType)
  communicationType: CommunicationType;

  @IsOptional()
  @IsEnum(ProtocolType)
  protocol: ProtocolType;

  @IsOptional()
  @IsString()
  vid: string;

  @IsOptional()
  @IsString()
  serialPort: string;

  @IsOptional()
  @IsNumber()
  vendorId: number;

  @IsOptional()
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsBoolean()
  bridgeMode: boolean;

  @IsOptional()
  @IsBoolean()
  isController: boolean;

  @IsOptional()
  station: any;

  @IsOptional()
  @IsString()
  aosDeviceType: string;

  @IsOptional()
  @IsBoolean()
  canBeController: boolean;

  // only for frontend
  @IsOptional()
  applications: any[];

  // only for frontend
  @IsOptional()
  devices: any[];

  // Only for request
  @IsOptional()
  @IsBoolean()
  isSoftDevice: boolean;

}


const deviceSchema = new Schema({
  name: {
    type: String,
    default: '',
    trim: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  area: {
    type: Schema.Types.ObjectId,
    ref: 'Area'
  },
  driver: String,
  serialNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  model: {
    type: String
  },
  registrationKey: {
    type: String,
    unique: true,
    sparse: true
  },
  status: String,
  batteryHealth: Number,
  type: {
    type: Schema.Types.ObjectId,
    ref: 'DeviceType',
    required: true
  },
  subType: {
    type: String,
    enum: Object.keys(DeviceSubType)
  },
  chargingStation: {
    type: Schema.Types.ObjectId,
    ref: 'Station'
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  mfgOrganization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  providerOrganizations: [{
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  }],
  system: {
    type: Schema.Types.ObjectId,
    ref: 'System'
  },
  floor: {
    type: Schema.Types.ObjectId
  },
  infrastructure: {
    type: Schema.Types.ObjectId,
    ref: 'Infrastructure'
  },
  currentTask: {
    type: Schema.Types.ObjectId,
    ref: 'InfrastructureTask'
  },
  defaultTask: {
    type: Schema.Types.ObjectId,
    ref: 'InfrastructureTask'
  },
  controller: {
    type: Schema.Types.ObjectId,
    ref: 'Device'
  },
  deviceBridge: {
    type: Schema.Types.ObjectId,
    ref: 'DeviceBridge'
  },
  address: String,
  port: String,
  additionalInfo: {},
  webSocket: {},
  sync: {},
  iO: {},
  userAssignable: {
    type: Boolean,
    default: false
  },
  aosToken: String,
  aosInternalTokenSecret: String,
  online: {
    type: Boolean,
    default: false
  },
  image: {
    signedUrl: String,
    name: String,
    contentType: String
  },
  simulatorConnected: {
    type: Boolean,
    default: false
  },
  runnerConnected: {
    type: Boolean,
    default: false
  },
  deviceKey: {
    type: String,
    required: false,
    default: ''
  },
  // Need for authorize NOT smart devices
  pid: {
    type: String
  },
  // Need for authorize NOT smart devices
  vid: {
    type: String
  },
  // Info from auto detect
  vendorId: {
    type: Number
  },
  // Info from auto detect
  productId: {
    type: Number
  },
  // Info from auto detect
  path: {
    type: String
  },
  // Info from auto detect
  manufacturer: {
    type: String
  },
  // Info from auto detect
  product: {
    type: String
  },
  communicationType: {
    type: String,
    enum: Object.keys(CommunicationType),
    default: CommunicationType.ETHERNET
  },
  protocol: {
    type: String,
    enum: Object.keys(ProtocolType)
  },
  bridgeMode: {
    type: Boolean,
    default: false
  },
  serialPort: {
    type: String
  },
  isController: {
    type: Boolean,
    default: false
  },
  station: {
    type: Schema.Types.ObjectId,
    ref: 'Station'
  },
  canBeController: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'device_manager__devices'
});

export type IDevice = Document & Device;

export const DeviceSchema = Db.connection.model<IDevice>('Device', deviceSchema);
