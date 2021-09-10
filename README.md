# Aitheon - system-graph

```all angular components/modules are required to follow these standards:

Naming and structure
These conventions should never be deviated from 
or modified without prior written authorization from the BOSS® or TEAMLEAD™. Modification without written consent can lead to termination.

Structure and Component Naming:
ModuleName (module folder)
    |
    |- component-name-list (component folder)
    |- component-name-form (component folder)
    |- component-name-detail (component folder)
    |- component-name-dashboard (component folder)
    |- shared (folder)
        |-index.ts
        |-component-name.service.ts
        |-component-name.ts
    |- module-name-routing.module.ts
    |- module-name-module.ts

Component Descriptions and Uses:

-list: 
List is a list component for said component. 
This should be used to create lists and inherited 
by other components needing a list of this module.

-form:
Form is a component to create a new object. 
This is a form to be filled out by user. This should be used to create new object of the model associated with this component and inherited 
by other components needing a create form of this module.

-detail:
Detail is a component to display an object to user.
This should be used to display the object of the model associated with this component and inherited 
by other components needing a create form of this module.

-dashboard:
dashboard is a custom representation of multiple types 
of data or combinations of data for the module and model 
associated with this module and components. This should be 
used to display the custom representaion of data and inherited 
by other components needing a the custom representation of this module.

-root: 
root is the base of a complex functionality made up of modules and components.
This is the "glue" container component that pulls everything together.

Shared Folder Descriptions and Uses:

index.ts:

component-name.service.ts:

component-name.ts
```

## Server Side Info
- routing library https://github.com/typestack/routing-controllers
- orm - mongosee

## Client Side info
- angular v7
- bootstrap v4.1
- ngx-bootstrap v3
- ngx-toastr

### 1. Setup cluster for developer
- `kubectl` setup required. [install kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/).
- Get package with credentials (3 files and sh script) from admin
- Download all files into one folder and navigate to this folder at console
- Run command

```
mv ./setup-cluster.txt ./setup-cluster.sh && chmod +x ./setup-cluster.sh && ./setup-cluster.sh
```


### 2. NPM config to work with private packages

Create a new "readonly" token (or ask for a token from a team lead), following "Working with tokens from the web" at  https://docs.npmjs.com/getting-started/working_with_tokens. 
Replace `00000000-0000-0000-0000-000000000000` below with your token and run it.  
Your teamlead will have to add permissions for your token.  

##### 2.1 Use an editor `vim` or `nano` and edit a `~/.profile` file.
But it depends on your default terminal cliient. For example, zsh has ~/.zshrc file, so edit the appropriate one inside `~` folder.
```
nano ~/.profile
```

##### 2.2 append following file with a correct token value
```
export NPM_TOKEN="00000000-0000-0000-0000-000000000000"
```

##### 2.3 Important! Full logout from ubuntu terminal

##### 2.4 Verify all correct
If result of below command is a token then you are good
```
echo $NPM_TOKEN
```

### 3. Run a MongoDB proxy
- Mongo will run on a default port. 
- Mongodb connection string is at .env file. But it will be loaded when app starts
```
./proxy-db.sh
```

### 4. npm i
### 5. npm run core:init
### 6. Run server: `npm run debug && npm start`
6.1 To verify all is good, it generates server/docs/swagger.json
API documentation address
```
http://localhost:3000/api/docs/
```

### 7. Install Docker
7.1 Add docker permission (for Ubuntu)
    Run this command and then completely log out of your account and log back in (if in doubt, reboot!)
    ```
    'sudo usermod -a -G docker $USER'
    ```

### 8. Generate REST Client code. 
script will generate services code and put it to `projects/aitheon/system-graph/src/lib/rest`. 
Run Rest lib generator. 
```
npm run core:generate-rest && npm run client:lib:watch
```
in case if above fails, run:
```
sudo rm -rf client/projects/aitheon/system-graph/src/lib/rest
```
### 9. Wait for previous step to compile or you will get error. 
Then Run Client lib
```
npm run client:watch
```

###### Optional. 
Documentation for Rest library. All generated models and rest services you can check also at `projects/aitheon/system-graph/src/lib/rest`
```
cd client && npm run docs
```
Documentation for Rest Library
http://localhost:3000/api/client-docs/

Webhook test

###### Cleanup node modules
```
rm -rf node_modules client/node_modules package-lock.json client/package-lock.json
npm cache clear --force
```

##### Forward Mail service to local port
- Mail will run on port 2525
```
./proxy-mail.sh
```

##### Forward Transporter/RabbitMq service to local port
- RabbitMq will run on port 5672
```
./proxy-rabbit.sh
```


# Aitheon Transporter


This library will take care of RPC requests and messaging between microservices. It is easy to bind to our existing services to RMQ routes. 

## Start
First, install the package:

```bash
npm i @aitheon/transporter
```

Then init transporter at `application.ts`

```javascript
const transportInit = () => {
    /**
     * Inner microservices communication via transporter
     */
    const metaPaths = [`${ path.resolve('./dist') }/modules/**/*.service.js`];
    const transporter = new TransporterBroker();
    transporter.init(metaPaths, environment.rabbitmq.uri, environment.service._id, 'info');
    transporter.services.forEach((Service: any) => {
      const transporterSrv = new Service(transporter.broker);
      Container.set(Service, transporterSrv);
    });

    return transporter;
};
const transporter = transportInit();

import { Application } from './config/application';
export default new Application(transporter);
```

Then you need to extend your service with TransporterService and add `@Transporter` annotation:

```javascript
import { Transporter, TransporterService, Action, Event } from '@aitheon/transporter';
import Container, { Service, Inject } from 'typedi';
...
@Service()
@Transporter()
export class ExamplesService extends TransporterService {

  // Example of how to inject services, part1
  mailerService: MailerService;

  constructor(broker: any, schema?: any) {
    super(broker, schema);
    // Example of how to inject services, part2
    this.mailerService = Container.get(MailerService);
  }

  @Action()
  async findAll(): Promise<Example[]> {
    return ExampleSchema.find();
  }

  @Event()
  async findEvent(data: any) {
    logger.info('[findEvent]', data);
    console.log('[findEvent]', data);
  }

  @Event({ name: 'ExamplesService.*' })
  async allTemplate(payload: any, sender: any, event: any) {
    console.log(`TEMPLATE2 '${event}' received from ${sender} node:`, payload);
  }

}
```

## Sending messages

To send message topic use `this.broker.call()` method in your service:

```javascript
const result = await this.broker.call<Example[]>('TEMPLATE.ExamplesService.findAll');
```
This method returns a Promise. You can spesify a you receive as <Example[]>


If you want to just notify services:
```javascript
this.broker.emit('ExamplesService.findEvent', { somedata: '11' }, 'TEMPLATE');
```


## Recieving messages

To listen for messages or actions bind your controller methods to subscription topics with **Event()** or **Action()** decorator:

**Event()** - used for async messaging, if service is down, a message will be delivered by RabbitMq when it's up
**Action()** - used for sync messaging, if service is not up you will get exception

```javascript
import Container, { Service, Inject } from 'typedi';

@Service()
@Transporter()
export class ExamplesService extends TransporterService {


  // Example of how to inject services, part1
  mailerService: MailerService;

  constructor(broker: any, schema?: any) {
    super(broker, schema);
    // Example of how to inject services, part2
    this.mailerService = Container.get(MailerService);
  }
  
  @Action()
  async findAll(): Promise<Example[]> {
    return ExampleSchema.find();
  }

  @Event()
  async findEvent(data: any) {
    logger.info('[findEvent]', data);
    console.log('[findEvent]', data);
  }

  @Event({ name: 'ExamplesService.*' })
  async allTemplate(payload: any, sender: any, event: any) {
    console.log(`TEMPLATE2 '${event}' received from ${sender} node:`, payload);
  }

}
```
