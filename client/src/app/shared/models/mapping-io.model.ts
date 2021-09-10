import { Input, Output } from '@aitheon/lib-graph';
import { IoType } from '../enums/io-type.enum';
import { SocketPlacement } from '../enums/socket-placement.enum';
import { NodeIo } from './node-io.model';

export class MappingIo extends NodeIo {
  constructor(
    public io: Input[] | Output[],
    public type: IoType,
    public placement: SocketPlacement,
    public id: string,
    public activeLeft?: boolean,
    public activeRight?: boolean,
  ) {
    super(io, type, placement, id);
  }
}
