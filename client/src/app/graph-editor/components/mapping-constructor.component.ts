import { Component, Input, InteractionType, IoConfig, Output } from '@aitheon/lib-graph';
import { ChannelMetadata, SocketMetadata } from '@aitheon/system-graph';
import { SocketPlacement } from '../../shared/enums/socket-placement.enum';
import { getIoPlacement } from '../shared/utils/get-io-placement';
import { SocketsService } from '../shared/services/sockets.service';

export class MappingConstructorComponent extends Component {
  constructor(
    private socketsService: SocketsService,
  ) {
    super('mapping');
  }

  createIoItem(io: SocketMetadata | ChannelMetadata, type: 'input' | 'output', side?: 'LEFT' | 'RIGHT') {
    const { name, socket, responseSocket, _id } = io as any;
    const socketId = responseSocket ? `${socket}::${responseSocket}` : socket;
    const ioKey = `${name}::${_id}${side ? `::${side}` : ''}`;

    const ioConfig: IoConfig = {
      socket: this.socketsService.getSocket(socketId),
      placement: getIoPlacement(io.placement as any, type, side as any),
      multiConns: type === 'output',
      type: responseSocket ? InteractionType.CHANNEL : InteractionType.EVENT,
    };

    return type === 'input' ? new Input(ioKey, name, ioConfig) : new Output(ioKey, name, ioConfig);
  }

  createIo(io: (SocketMetadata | ChannelMetadata)[], ioType: 'input' | 'output', isSubgraphIo?: boolean) {
    return io.reduce((result, currentIo) => {
      const { placement } = currentIo;
      if (placement !== SocketPlacement.CENTER || isSubgraphIo) {
        return [
          ...result,
          this.createIoItem(currentIo, ioType, null),
        ];
      }

      return [
        ...result,
        this.createIoItem(currentIo, ioType, SocketPlacement.LEFT),
        this.createIoItem(currentIo, ioType, SocketPlacement.RIGHT),
      ];
    }, []);
  }

  builder(node) {
    const { input, output } = node.data;
    for (const socket of this.createIo([input], 'input', false)) {
      node.addInput(socket);
    }
    for (const socket of this.createIo([output], 'output', false)) {
      node.addOutput(socket);
    }
    return node;
  }

  worker(node, inputs, outputs) {}
}
