import { IoSettings } from '@aitheon/system-graph';

export class GraphNode {
  constructor(
    public release: any,
    public ioSettings?: IoSettings[],
    public node?: any,
  ) {}
}
