
import { Graph } from '../graph/graph.model';
import { FunctionalGraphNode, SubgraphGraphNode } from '../graph/graph-nodes.model';

export enum InfrastructureType {
  BUILDING = 'BUILDING',
  FACTORY = 'FACTORY',
  WAREHOUSE = 'WAREHOUSE'
}


export class AosDeployment {
  driver: any;
  appFile: string;
  appBuildFile: string;
  subgraphFiles: string[];
  subgraphBuildFile: string;

  // this needs to be extended for system
  node: SubgraphGraphNode;
  systemId: any;
  deviceMap: [
    {
      deviceId: any;
      nodeId: any;
    }
  ];

  // this is the extention for device
  // node: FunctionalGraphNode;
  deviceId: any;

}

export class EmbeddedDeployment {
  node: FunctionalGraphNode;
  DeviceId: any;
  driver: any;
  appFile: string;
}



export class Deployment {
  cloud: {
    graph: Graph;
  };

  systems: AosDeployment[];

  devices: AosDeployment[];

  embeddedDevices: EmbeddedDeployment[];

}


export function flattenGraph(graph: Graph) {

  // do switch on type

  // aos cloud

  // aos

}

export function generateDeployment(graph: Graph ) {
  // deployment graph object
  // temp array for connections

  // create new graph (flattened graph) object. This will hold our flattened graph
  // start at org graph
    // get nodes add to flattened graph

    // if AOS_Embedded handle differently

    // add connections to array
    // get subgraphs
    // flatten subgraphs
    // flattenGraph(graph);
    // add nodes to flattened graph
    // add connections to array
    // process connections
    // loop
  //
}

