import { NodeData } from '../models/node.model';
import { Node } from '@aitheon/lib-graph';

export interface MappingModalData {
  isExist: boolean;
  inputNodeData?: NodeData;
  outputNodeData?: NodeData;
  inputNodeId?: string;
  outputNodeId?: string;
  node?: Node;
  inputId?: string;
  outputId?: string;
  isIoSelected?: boolean;
}
