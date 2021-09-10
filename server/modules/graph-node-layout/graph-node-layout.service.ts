import { Current } from '@aitheon/core-server';
import { Transporter, TransporterService } from '@aitheon/transporter';
import Container, { Service } from 'typedi';
import { GraphNodeLayout, GraphNodeLayoutSchema } from './graph-node-layout.model';
// tslint:disable: no-null-keyword

@Service()
@Transporter()
export class GraphNodeLayoutService extends TransporterService {

  constructor() {
    super(Container.get('TransporterBroker'));
  }


  create(layout: GraphNodeLayout, owner = false) {
    if (owner) {
      layout.user = undefined;
      layout.main = true;
    }
    return GraphNodeLayoutSchema.create(layout);
  }


  update(layout: GraphNodeLayout, owner = false) {
    if (owner) {
      layout.user = undefined;
      layout.main = true;
    }
    const { _id, ...dataToSave } = layout;
    return GraphNodeLayoutSchema.findOneAndUpdate({ _id }, dataToSave);
  }

  async findByProjectId(projectId: string, owner: boolean, current: Current, graphNodeId?: string) {
    const userQuery: {[key: string]: any} = {projectId, user: current.user._id, organization: current.organization && current.organization._id};
    const ownerQuery: {[key: string]: any} = {user: null, projectId, main: true, organization: current.organization && current.organization._id};
    if (owner) {
      return GraphNodeLayoutSchema.find(ownerQuery);
    }

    if (graphNodeId) {
      userQuery.graphNodeId = graphNodeId;
    }
    const [userLayouts, ownerLayouts] = await Promise.all([GraphNodeLayoutSchema.find(userQuery), GraphNodeLayoutSchema.find(ownerQuery)]);

    const layouts = [];
    for (const ownerLayout of ownerLayouts) {
      const userLayout = userLayouts.find(u => (u.type === ownerLayout.type && u.name === ownerLayout.name));
      layouts.push(userLayout || ownerLayout);
    }
    for (const userLayout of userLayouts) {
      if (ownerLayouts.findIndex(u => (u.type === userLayout.type && u.name === userLayout.name)) === -1) {
        layouts.push(userLayout);
      }
    }
    return layouts;
  }


  delete(projectId: string, current: Current, owner = false) {
    const query: {[key: string]: any} = {projectId, user: current.user._id, organization: current.organization && current.organization._id};
    if (owner) {
      query.user = undefined;
      query.main = true;
    }
    return GraphNodeLayoutSchema.findOneAndDelete(query);
  }
}
