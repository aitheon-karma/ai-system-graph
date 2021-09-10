import { Project } from '@aitheon/creators-studio-server';
import { SocketMetadata } from '../nodes/node.model';

export interface ProjectData {
  project: Project;
  release: {
    _id: string;
    tag: string;
    name: string;
    inputs: SocketMetadata[];
    outputs: SocketMetadata[];
    parameters: Map<string, any>
  };
}

export interface Service {
  _id: string;
  serviceType: 'any' | 'personal' | 'organization';
  core: boolean;
  name: string;
  url: string;
}
