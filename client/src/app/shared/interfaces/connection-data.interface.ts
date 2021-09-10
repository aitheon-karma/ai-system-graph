import { InteractionType } from '@aitheon/lib-graph';
import { IoData } from './io-data.interface';

export interface ConnectionData {
  source: IoData;
  target: IoData;
  type: InteractionType;
  pins: { x: number, y: number }[];
}

