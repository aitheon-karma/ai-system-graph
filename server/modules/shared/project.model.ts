import { Schema, Document, Model, model, Types } from 'mongoose';
import Db from '@aitheon/core-server/dist/config/db';
import { Organization } from '@aitheon/core-server';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsNotEmpty, IsEnum, IsNumber, ValidateNested, IsMongoId, IsDate, IsDefined, IsOptional, Min, IsDateString, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { Runtime } from '../nodes/node-group.model';

export enum ProjectType {
  COMPUTE_NODE = 'COMPUTE_NODE',
  DEVICE_NODE = 'DEVICE_NODE',
  SERVICE = 'SERVICE',
  INTERFACE = 'INTERFACE',
  DIGIBOT = 'DIGIBOT',
  LIBRARY = 'LIBRARY',
  APP = 'APP',
  ROBOT = 'ROBOT'
}

export enum ProjectLanguage {
  BLOCK = 'BLOCK',
  JAVASCRIPT = 'JAVASCRIPT',
  PYTHON = 'PYTHON',
  C = 'C',
  CPP = 'CPP'
}

// metadata about the project
export class ProjectMeta {
  initiatorService?: string;
  infrastructureId?: string;
  stationId?: string;
  deviceId?: string;
  controllerId?: string;
  projectId?: string;
}

@JSONSchema({ description: 'ProjectDependency' })
export class ProjectDependency {

  @IsString()
  version: string;

  @IsString()
  project: string;

}

@JSONSchema({ description: 'Project' })
export class Project {

  @IsMongoId()
  _id: string;

  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsEnum(ProjectType)
  projectType: ProjectType;

  @IsString()
  summary: string;

  @IsString()
  user: string;

  @IsString()
  organization: string | Organization;

  @IsEnum(ProjectLanguage)
  language: ProjectLanguage;

  @IsDateString()
  lastOpened: Date;

  @IsBoolean()
  archived: boolean;

  @IsDateString()
  @IsOptional()
  createdAt: Date;

  @IsDateString()
  @IsOptional()
  updatedAt: Date;

  @ValidateNested({ each: true })
  @Type(() => ProjectDependency)
  dependencies: ProjectDependency[];

  @IsNumber()
  repositoryId: Number;


  @IsEnum(Runtime)
  runtime: Runtime;

  @IsString()
  @IsOptional()
  @Type(() => ProjectMeta)
  meta: ProjectMeta;
}

/**
 * Database schema/collection
 */
const projectSchema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 512
  },
  slug: {
    type: String,
    required: true,
    maxlength: 512
  },
  summary: {
    type: String,
    maxlength: 2048
  },
  projectType: {
    type: String,
    enum: Object.keys(ProjectType)
  },
  language: {
    type: String,
    // tslint:disable-next-line:no-null-keyword
    enum: Object.keys(ProjectLanguage).concat([null])
  },
  lastOpened: {
    type: Date,
    default: new Date()
  },
  archived: {
    type: Boolean,
    default: false
  },
  user: Schema.Types.ObjectId,
  runtime: {
    type: String,
    enum: Object.keys(Runtime)
  },
  organization: Schema.Types.ObjectId,
  dependencies: [{
    version: String,
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project'
    }
  }],
  repositoryId: Number,
    meta: {
      type: Schema.Types.Mixed,
    }
},
{
  timestamps: true,
  collection: 'creators_studio__projects'
});


projectSchema.pre('save', function(next, done) {
  const self = this as any;
  Db.connection.models['Project'].findOne({ organization: self.organization, user: self.user, name: self.name, _id: { $ne: self._id } }, function(err, project) {
      if (err) {
         return next(err);
      } else if (project) {
          self.invalidate('name', 'Name must be unique per organization or user');
          return next(new Error('Name must be unique per organization or user'));
      }
      next();
  });
});

export type IProject = Document & Project;
export const ProjectSchema = Db.connection.model<IProject>('Project', projectSchema);
