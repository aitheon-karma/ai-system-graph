import { Input, Output } from '@aitheon/lib-graph';
import { IoType } from '../enums/io-type.enum';
import { SocketPlacement } from '../enums/socket-placement.enum';

export class NodeIo {
  constructor(
    public io: Input | Output | Input[] | Output[],
    public type: IoType,
    public placement: SocketPlacement,
    public id: string,
  ) {}
}
