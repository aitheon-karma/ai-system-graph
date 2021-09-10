import { Component, Input, InteractionType, IoConfig, Output } from '@aitheon/lib-graph';
import { ChannelMetadata, IoSettings, SocketMetadata } from '@aitheon/system-graph';
import { SocketPlacement } from '../../shared/enums/socket-placement.enum';
import { NodeData } from '../../shared/models/node.model';
import { getIoPlacement } from '../shared/utils/get-io-placement';
import { isIoMultiple } from '../shared/utils/is-io-multiple';
import { SocketsService } from '../shared/services/sockets.service';

export class NodeConstructorComponent extends Component {
  ioSettings: IoSettings[];

  constructor(
    private socketsService: SocketsService,
  ) {
    super('node');
  }

  createIoItem(
    io: SocketMetadata | ChannelMetadata,
    type: 'input' | 'output',
    side?: 'LEFT' | 'RIGHT',
    isSubgraphIo?: boolean,
    placement?: SocketPlacement,
  ) {
    const { name, socket, responseSocket, multiple, _id } = io as any;
    const socketId = responseSocket ? `${socket}::${responseSocket}` : socket;
    const ioKey = `${name}::${_id}${side ? `::${side}` : ''}`;
    const ioConfig: IoConfig = {
      socket: this.socketsService.getSocket(socketId),
      placement: getIoPlacement(placement, type, side as any),
      multiConns: isSubgraphIo || isIoMultiple(type, multiple, !!responseSocket),
      type: responseSocket ? InteractionType.CHANNEL : InteractionType.EVENT,
    };

    return type === 'input' ? new Input(ioKey, name, ioConfig) : new Output(ioKey, name, ioConfig);
  }

  createIo(io: (SocketMetadata | ChannelMetadata)[], ioType: 'input' | 'output', isSubgraphIo?: boolean) {
    return io.reduce((result, currentIo) => {
      const placement = this.ioSettings.find(settings => settings.io === currentIo._id)?.placement || currentIo.placement;
      if (placement !== SocketPlacement.CENTER || isSubgraphIo) {
        return [
          ...result,
          this.createIoItem(currentIo, ioType, null, isSubgraphIo, placement as any),
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
    const { inputs = [], outputs = [], subGraphIoType, graphNode } = node.data as NodeData;
    this.ioSettings = graphNode?.ioSettings || [];
    const isSubGraphInterface = !!subGraphIoType;
    for (const socket of this.createIo(inputs, 'input', isSubGraphInterface)) {
      node.addInput(socket);
    }
    for (const socket of this.createIo(outputs, 'output', isSubGraphInterface)) {
      node.addOutput(socket);
    }
    return node;
  }

  worker(node, inputs, outputs) {}
}
