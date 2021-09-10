import { ApplicationType, GraphType, NodeType } from '@aitheon/core-client';
import { SocketMetadata } from '@aitheon/system-graph';
import { Component, OnInit, OnChanges, SimpleChanges, Input } from '@angular/core';
import { SocketPlacement } from '../../../shared/enums/socket-placement.enum';

interface PreviewIo {
  title: string;
  placement: SocketPlacement;
  type: 'INPUT' | 'OUTPUT';
}

@Component({
  selector: 'ai-node-preview',
  templateUrl: './node-preview.component.html',
  styleUrls: ['./node-preview.component.scss']
})
export class NodePreviewComponent implements OnInit, OnChanges {
  @Input() node: any;
  @Input() toolboxPreview = true;
  @Input() size: string;

  itemType = {
    ...GraphType,
    ...NodeType,
  };
  ioItems: PreviewIo[];
  placements = SocketPlacement;
  showMore: boolean;
  styles: {
    border: string,
    background: string,
  };
  logoUrl: string;
  inputs: any;
  outputs: any;
  nodeType = {
    ...NodeType,
    SUBGRAPH: 'SUBGRAPH',
    SERVICE: 'SERVICE',
    CREATED: 'CREATED',
    DEVICE_NODE: 'DEVICE_NODE',
    COMPUTE_NODE: 'COMPUTE_NODE',
    ROBOT: 'ROBOT',
    APP: 'APP'
  };

  private static prepareIo(io: SocketMetadata[] = [], type: 'INPUT' | 'OUTPUT' = 'INPUT') {
    return io.map(ioItem => ({
      io: ioItem,
      type,
    }));
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes.node && changes.node.currentValue) {
      this.setStyles();
      this.createIoArray();
    }
  }

  setStyles() {
    const { storeRequest = {} }  = this.node || {};
      const { nodeStyling = {} } = storeRequest || {};
      this.styles = {
        background: nodeStyling.backgroundColor,
        border: nodeStyling.borderColor
          ? `1px solid ${nodeStyling.borderColor.includes('transparent') ? '#454545' : nodeStyling.borderColor}`
          : null,
      };
      this.logoUrl = nodeStyling.logo
        ? nodeStyling.logo.url : null;
  }

  createIoArray() {
    let { inputs = [], outputs = [], nodeChannels = [] } = this.node || {};
    const { lastRelease } = this.node || {};

    if (lastRelease) {
      inputs = lastRelease.inputs || [];
      outputs = lastRelease.outputs || [];
      nodeChannels = lastRelease.nodeChannels || [];
    }

    const previewInputs = [...inputs, ...nodeChannels.filter(({ type }) => type === 'server')];
    const previewOutputs = [...outputs, ...nodeChannels.filter(({ type }) => type === 'client')];

    this.ioItems = [
      ...NodePreviewComponent.prepareIo(previewInputs, 'INPUT'),
      ...NodePreviewComponent.prepareIo(previewOutputs, 'OUTPUT')].map((ioItem) => {
      return {
        title: ioItem.io.name,
        placement: ioItem.io.placement
          ? ioItem.io.placement
          : (ioItem.type === 'INPUT' ? SocketPlacement.LEFT : SocketPlacement.RIGHT) as any,
        type: ioItem.type,
      };
    });

    this.inputs = this.ioItems.filter(input => input.type === 'INPUT');
    this.outputs = this.ioItems.filter(input => input.type === 'OUTPUT');
  }

  onDragStart(event: DragEvent, node: any) {
    const offset = {
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    };
    event.dataTransfer.setData('node', JSON.stringify(node));
    event.dataTransfer.setData('offset', JSON.stringify(offset));
  }

  onClickOutside(event: Event) {
    this.showMore = false;
  }

  toggleMore(event: Event) {
    this.stopEvent(event);
    this.showMore = !this.showMore;
  }

  stopEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }

  getIOData(arr: any) {
    const res = [];
    arr.forEach(item => {
      res.push(item.title);
    });
    return res.join('<br />');
  }

  get isDashboardApplication(): boolean {
    return this.node.project.projectType === this.nodeType.APP && this.node.project.projectSubType === ApplicationType.DASHBOARD;
  }

  get isApplication(): boolean {
    return this.node.project.projectType === this.nodeType.APP && this.node.project.projectSubType === ApplicationType.APPLICATION;
  }

  get isAutomation(): boolean {
    return this.node.project.projectType === this.nodeType.APP && this.node.project.projectSubType === ApplicationType.AUTOMATION;
  }

  get isRobotAppNode(): boolean {
    return this.node?.project?.projectType === this.nodeType.ROBOT && this.node.project.runtime === 'AOS';
  }
}
