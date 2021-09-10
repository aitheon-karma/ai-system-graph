import { Service, Inject } from 'typedi';
import { RestService } from '../core/rest.service';

@Service()
export class DevicesService {

  @Inject()
  restService: RestService;

  async findById(token: string, deviceId: String, organization: string): Promise<any> {
    const query = {
      uri: `${this.getUsersBaseUrl()}/api/devices/${deviceId}`,
      token,
      organization
    };

    return this.restService.get(query);
  }

  private getUsersBaseUrl() {
    return '/device-manager';
  }

}
