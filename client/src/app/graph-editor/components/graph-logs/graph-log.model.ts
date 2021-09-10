import { GraphNode } from "@aitheon/system-graph";

export class GraphLog {
  graphNodeId: string;
  graphNode?: GraphNode
  log: string;
  stream: string;
  timestamp: Date;
};
