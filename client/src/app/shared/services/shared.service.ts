import { Injectable } from '@angular/core';
import { RestService } from '@aitheon/core-client';
import { Observable, of, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { delay, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  public _image$: Subject<any> = new Subject<any>();

  constructor(
    private restService: RestService,
  ) {}

  public uuidv4Generator() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      // tslint:disable-next-line:no-bitwise triple-equals
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  public getUserById(userId: string): Observable<any> {
    return this.restService.fetch(environment.baseApi + environment.usersURI + `/api/users/${userId}`, null, true);
  }

  public openNodeImage(image) {
    this._image$.next(image);
  }

  public getImageFromNode() {
    return this._image$.asObservable();
  }

  public delay(time: number = 0): Observable<unknown> {
    return of().pipe(take(1), delay(time));
  }
}
