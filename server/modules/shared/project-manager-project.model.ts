import { Schema, Document } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsEnum, IsNumber, ValidateNested, IsMongoId, IsOptional, IsDateString, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProjectWorkspaces {
  GANTT_CHART = 'GANTT_CHART',
  KANBAN = 'KANBAN',
  MINDMAP = 'MINDMAP'
}


export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED'
}

export enum DriveFolderStatus {
  CREATED = 'CREATED',
  ERROR = 'ERROR',
  PENDING = 'PENDING'
}

export enum ProjectType {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC'
}

export class ProjectProgress {

  @IsOptional()
  @IsNumber()
  toDo: number;

  @IsOptional()
  @IsNumber()
  inProgress: number;

  @IsOptional()
  @IsNumber()
  done: number;

  @IsNumber()
  @IsOptional()
  issues: number;

}

@JSONSchema({ description: 'Project' })
export class Project {

  @IsMongoId()
  @IsOptional()
  _id: string;

  @IsOptional()
  roles: any[];

  @IsString()
  @IsOptional()
  name: string;

  @IsString()
  @IsOptional()
  description: string;


  @IsOptional()
  @IsEnum(ProjectWorkspaces)
  workspaces: string[];

  @IsString()
  @IsOptional()
  cover: string;


  @IsDateString()
  @IsOptional()
  estimatedCompletionDate: Date;


  @IsEnum(ProjectType)
  @IsOptional()
  type: ProjectType;

  @IsOptional()
  key: string;


  @IsOptional()
  @IsBoolean()
  isPlatformProject: boolean;

  @IsOptional()
  createdBy: any;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;


  @IsString()
  @IsOptional()
  summary: String;

  @IsEnum(ProjectStatus)
  @IsOptional()
  status: ProjectStatus;

  @IsEnum(DriveFolderStatus)
  @IsOptional()
  driveFolderStatus: DriveFolderStatus;

  @IsNumber()
  @IsOptional()
  priority: Number;

  @IsBoolean()
  @IsOptional()
  issueBoardEnabled: Boolean;

}

/**
 * Database schema/collection
 */
const projectSchema = new Schema({
  name: String,

  description: String,

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  estimatedCompletionDate: Date,

  roles: [{
    type: Schema.Types.Mixed
  }],

  repositoryUrl: String,

  status: {
    type: String,
    enum: Object.keys(ProjectStatus),
    default: ProjectStatus.ACTIVE
  },

  driveFolderStatus: {
    type: String,
    enum: Object.keys(DriveFolderStatus),
    default: DriveFolderStatus.PENDING
  },

  type: {
    type: String,
    enum: Object.keys(ProjectType),
    default: ProjectType.PUBLIC
  },

  key: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },

  priority: {
    type: Number,
    default: 5
  },

  issueBoardEnabled: {
    type: Boolean,
    default: false
  },

  progress: {
    inProgress: {
      type: Number,
      default: 0
    },
    done: {
      type: Number,
      default: 0
    },
    toDo: {
      type: Number,
      default: 0
    },
    issues: {
      type: Number,
      default: 0
    }
  },

  isPlatformProject: {
    type: Boolean,
    default: false
  },

  workspaces: [{
    type: String,
    enum: Object.keys(ProjectWorkspaces)
  }],

  cover: String,

},
  {
    timestamps: true,
    collection: 'project_manager__projects'
  }
);


export type IProject = Document & Project;
export const ProjectSchema = Db.connection.model<IProject>('PMProject', projectSchema);

export const projectPopulateDefaults = '_id name description';
