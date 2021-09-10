import { SocketMetadata } from '@aitheon/system-graph';

export interface NodeWithIo {
  nodeName: string;
  nodeId: string;
  io: SocketMetadata[];
  filteredIo?: SocketMetadata[];
}
