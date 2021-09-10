import { Component } from '@aitheon/lib-graph';

export class InformationNodeConstructor extends Component {
  constructor(
    name: string,
  ) {
    super(name);
  }

  builder(node) {
    return node;
  }

  worker(node, inputs, outputs) {}
}
