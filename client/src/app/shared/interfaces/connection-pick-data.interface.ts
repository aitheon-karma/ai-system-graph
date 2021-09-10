import { Socket } from '@aitheon/lib-graph';
import { IoType } from '../enums/io-type.enum';

export interface ConnectionPickData {
  picked?: boolean;
  ioType: IoType;
  nodeId: string;
  socket: Socket;
  isMappingIo?: boolean;
  connectionData?: { inputKey: string, outputKey: string };
}

