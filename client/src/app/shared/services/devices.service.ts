// tslint:disable-next-line:import-blacklist
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { RestService } from '@aitheon/core-client';
import { environment } from '../../../environments/environment';

@Injectable({providedIn: 'root'})
export class DevicesService {

  constructor(private restService: RestService) { }

  list(): Observable<Array<any>> {
    return this.restService.fetch(`${ environment.baseApi }/device-manager/api/devices-access/user-assignable`, null, true);
  }

  deviceAccesses(deviceId: string) {
    return this.restService.fetch(`${ environment.baseApi }/device-manager/api/devices-access/${ deviceId }`, null, true);
  }

  removeDeviceAccesses(deviceId: string, deviceAccessId: string): Observable<void> {
    // tslint:disable-next-line:max-line-length
    return this.restService.delete(`${ environment.baseApi }/device-manager/api/devices-access/${ deviceId }/${ deviceAccessId }`, true);
  }

}

