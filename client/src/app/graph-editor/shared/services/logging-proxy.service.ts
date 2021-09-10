import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class LoggingProxyService implements OnDestroy {

  onMessage = new Subject<any>();

  private url: string;
  private token: string;
  private baseUrl = `${ (environment.production ? window.location.origin : environment.baseApi).replace('https', 'wss')}/logging-proxy/ws`;
  private websocket: WebSocket;

  constructor() {
  }

  ngOnDestroy() {
    this.disconnect();
  }

  /*
  * connect to WebSocket
  * */
  connect(token: string): void {
    this.token = token;
    this.url = `${this.baseUrl}?token=${token}`;
    this.websocket = new WebSocket(this.url);
    this.websocket.onmessage = (evt) => {
      try {
        this.onMessage.next(JSON.parse(evt.data));
      } catch (err) {
      }
    };
  }

  disconnect() {
    this.websocket.close();
  }

}
