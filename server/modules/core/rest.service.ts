import { Service, Inject } from 'typedi';
import * as request from 'request-promise-native';

export interface RestOptions {
  uri: string;
  token: string;
  organization?: string;
  body?: any;
  qs?: any;
}

@Service()
export class RestService {

  constructor() { }
  // `http://ai-treasury.ai-treasury.svc.cluster.local:${ process.env.AI_AUTH_SERVICE_PORT || 3000 }`
  private baseUri = `https://${process.env.DOMAIN}`;
  // private baseUri = 'https://dev.aitheon.com';

  private getOptions(options: RestOptions) {

    const headers: any = {
      'Content-type': 'application/json',
      'Authorization': `JWT ${options.token}`,
      'organization-id': options.organization ? options.organization : undefined
    };

    return {
      headers,
      json: true,
      uri: `${this.baseUri}${options.uri}`,
      body: options.body ? options.body : undefined,
      qs: options.qs ? options.qs : undefined,
    };
  }

  async get(options: RestOptions) {
    return request.get(this.getOptions(options));
  }

  async post(options: RestOptions) {
    return request.post(this.getOptions(options));
  }

  async put(options: RestOptions) {
    return request.put(this.getOptions(options));
  }

  async delete(options: RestOptions) {
    return request.delete(this.getOptions(options));
  }

}
