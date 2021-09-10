import { Socket } from '@aitheon/lib-graph';
import { SocketsRestService, Socket as SocketDb } from '@aitheon/system-graph';
import { Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';

import { get } from '../../../shared/utils/get';

export interface SocketData {
  socketId: string;
  color: string;
  isAnyData: boolean;
  responseSocketId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocketsService {
  private anyDataSocketId: string;
  private sockets: {
    color: string,
    socket: SocketDb,
  }[] = [];
  private graphSockets: Socket[] = [];

  constructor(
    private socketsRestService: SocketsRestService,
  ) {}

  public setSockets() {
    return forkJoin([
      this.socketsRestService.list(),
      this.socketsRestService.listGroups(),
    ]).pipe(tap(([sockets, groups]) => {
        for (const socket of sockets) {
          const { name, group, _id: socketId, structure } = socket;
          const socketGroup = groups.find(({ _id }) => _id === group) || {};

          if (name === 'AnyData' && get(structure, 'properties.data.type') === 'object') {
            this.createAnyDataSocket(socketId, socketGroup.color);
          }

          this.sockets.push({
            color: socketGroup.color,
            socket,
          });
        }
      }),
    );
  }

  createAnyDataSocket(id: string, color: string = '#eee') {
    this.anyDataSocketId = id;
    this.graphSockets.push(new Socket('Any Data', {
      isAnyData: true,
      socketId: id,
      color,
    } as SocketData));
  }

  public getSocket(socketId: string): Socket {
    const isChannel = socketId.includes('::');
    const socket: Socket = this.graphSockets.find(({ data }) => {
      const socketData = <SocketData>data;
      return socketId === `${socketData.socketId}${isChannel ? '::' + socketData.responseSocketId : ''}`;
    });

    return socket ? socket : this.createSocket(socketId);
  }

  private createSocket(id: string): Socket {
    const [socketId, responseSocketId] = id.split('::');
    const dbSocket = this.sockets.find(({ socket }) => socket._id === socketId);

    if (dbSocket) {
      const socket = new Socket(dbSocket.socket.name, {
        socketId,
        responseSocketId,
        color: dbSocket.color,
        isAnyData: false,
      } as SocketData);

      if (this.anyDataSocket) {
        socket.combineWith(this.anyDataSocket);
        this.anyDataSocket.combineWith(socket);
      }

      this.graphSockets.push(socket);
      return socket;
    }

    return this.anyDataSocket;
  }

  public isSocketsCompatible(firstSocket: Socket, secondSocket: Socket): boolean {
    return firstSocket.compatibleWith(secondSocket);
  }

  public get anyDataSocket() {
    return this.graphSockets.find(({ data }) => (<any>data).socketId === this.anyDataSocketId);
  }

  public get anySocketId() {
    return this.anyDataSocketId;
  }
}
