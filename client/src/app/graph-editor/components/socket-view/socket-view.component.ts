import { NodeStatus, NodeType } from '@aitheon/core-client';
import { InteractionType, IO, Output as NodeOutput, Socket } from '@aitheon/lib-graph';
import { NodeInput } from '@aitheon/transporter/dist/node-input';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { SocketPlacement } from '../../../shared/enums/socket-placement.enum';
import { ConnectionPickData } from '../../../shared/interfaces/connection-pick-data.interface';
import { NodeIo } from '../../../shared/models/node-io.model';
import { NodeModel } from '../../../shared/models/node.model';
import { get } from '../../../shared/utils/get';
import { SocketData, SocketsService } from '../../shared/services/sockets.service';

@Component({
  selector: 'ai-socket-view',
  templateUrl: './socket-view.component.html',
  styleUrls: ['./socket-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocketViewComponent implements OnInit, OnChanges {
  @Input() public placement: SocketPlacement;
  @Input() public isInterfaceNode: boolean;
  @Input() public ioData: NodeIo;
  @Input() public io: IO;
  @Input() private connectionPickData: ConnectionPickData;
  @Input() private node: NodeModel;

  public socketPlacements = SocketPlacement;
  public socketStyles: {
    background: string;
    boxShadow: string;
    opacity: string;
  };
  public isChannel: boolean;
  public channelType: 'client' | 'server';
  public serverSocket: Socket;

  constructor(
    private cdr: ChangeDetectorRef,
    private socketsService: SocketsService,
  ) {}

  ngOnInit(): void {
    this.isChannel = this.io.interactionType === InteractionType.CHANNEL;
    if (this.isChannel) {
      this.channelType = this.io instanceof NodeOutput ? 'client' : 'server';

      const responseSocket = (this.io.socket.data as any).responseSocketId;

      // check if responseSocket exists.
      this.serverSocket = responseSocket
        ? this.socketsService.getSocket((this.io.socket.data as any).responseSocketId)
        : this.socketsService.anyDataSocket;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.setStyling();
  }

  setStyling(): void {
    const socketData = this.io?.socket?.data as any;
    const isConnectedAndRunning = this.isIoConnectedAndRunning;
    const isPickedAndHasSameType = this.isIoPickedAndHasSameType;
    if (isConnectedAndRunning || isPickedAndHasSameType) {
      this.socketStyles = {
        opacity: isPickedAndHasSameType && !this.isIoCompatible ? '0.3' : '1',
        background: socketData?.color,
        boxShadow: isConnectedAndRunning ? 'none' : `1px 0px 20px 0px ${socketData?.color}`,
      };
    } else {
      this.socketStyles = { background: '#7e7e7e', boxShadow: 'none', opacity: '1' };
    }
    this.cdr.detectChanges();
  }

  get isIoConnectedAndRunning(): boolean {
    if (this.statusIsRunning) {
      if (this.io?.connections?.length) {
        if (this.io instanceof NodeOutput) {
          return true;
        } else {
          for (const connection of this.io.connections) {
            const outputNodeStatus = get(connection, 'output.node.data.status');
            if ([NodeStatus.RUNNING, NodeStatus.RUNNING_ANOTHER_RELEASE].includes(outputNodeStatus)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  get isIoCompatible(): boolean {
    const { socket } = this.io;
    const socketData = socket.data as any;
    return !!((this.connectionPickData?.isMappingIo
      ? this.connectionPickData?.nodeId !== this.node.id as any
      : true) && (
      socketData?.isAnyData
      || (this.connectionPickData?.socket?.data as any)?.isAnyData
      || socketData?.socketId === (this?.connectionPickData?.socket?.data as SocketData)?.socketId
      && socketData?.responseSocketId === (this?.connectionPickData?.socket?.data as SocketData)?.responseSocketId
    ));
  }

  get isIoPickedAndHasSameType(): boolean {
    return this.connectionPickData?.picked
      && this.ioData?.type === this?.connectionPickData?.ioType
      && !this.io?.connections?.length
      && this.io.isMappingIo === this.connectionPickData?.isMappingIo;
  }

  get statusIsRunning(): boolean {
    return this.node.data.type === NodeType.SERVICE_NODE ||
      [NodeStatus.RUNNING, NodeStatus.RUNNING_ANOTHER_RELEASE].includes(this.node.data.status as any);
  }

  get channelDescription(): string {
    return `Channel
    <br>
      - Client Socket: ${this.io?.socket?.name}
    <br>
      - Server Socket: ${this.serverSocket?.name || '-'}
    `;
  }
}
