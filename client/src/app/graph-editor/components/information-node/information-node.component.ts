import { Node, NodeEditor } from '@aitheon/lib-graph';
import { Component, Input, OnInit, AfterViewInit, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { NodeType } from '@aitheon/core-client';

import { distinctUntilChanged, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'ai-information-node',
  templateUrl: './information-node.component.html',
  styleUrls: ['./information-node.component.scss']
})
export class InformationNodeComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('nodeView') nodeView: ElementRef;

  @Input() node: Node;
  @Input() editor: NodeEditor;
  @Input() clicked: MouseEvent;
  nodeType = NodeType;
  control: FormControl;
  showContextMenu: boolean;
  contextMenuPosition: {
    left: string,
    top: string,
  };
  isResizing: boolean;
  readonly charWidth = 7.37;
  readonly lineHeight = 22;
  cols: number;
  rows: number;

  constructor() { }

  ngOnInit() {
    if (this.nodeData.type === NodeType.TEXTAREA) {
      this.initControl();
    }
    this.onNodeTranslate();
  }

  ngAfterViewInit(): void {
    if (this.nodeData.size && this.nodeData.size.length) {
      const [width, height] = this.nodeData.size;
      this.cols = Math.round(width / this.charWidth);
      this.rows = Math.round(height / this.lineHeight);
      this.node.update();
    }
  }

  onNodeTranslate(): void {
    this.editor.on('nodetranslate', () => {
      if (this.isResizing) {
        return false;
      }
    });
  }

  onPointerUp(): void {
    this.nodeData.size = [this.nodeView.nativeElement.offsetWidth, this.nodeView.nativeElement.offsetHeight];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.clicked) {
      if (this.showContextMenu) {
        this.showContextMenu = false;
      }
    }
  }

  initControl() {
    this.control = new FormControl(this.nodeData.text);
    this.control.valueChanges.pipe(
      distinctUntilChanged(),
      debounceTime(300),
    ).subscribe(value => {
      this.nodeData.text = value;
      this.save();
    });
  }

  onRightClick(event: MouseEvent) {
    this.stopEvent(event);

    this.contextMenuPosition = {
      left: `${event.offsetX}px`,
      top: `${event.offsetY}px`,
    };
    this.showContextMenu = true;
    this.node.update();
  }

  onNodeDelete() {
    this.editor.removeNode(this.node);
    this.save();
  }

  stopEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }

  save() {
    this.editor.trigger('save');
  }

  onDragStart(e: PointerEvent): void {
    const { offsetX, offsetY } = e;
    const { offsetWidth, offsetHeight } = e.target as any;
    this.isResizing = offsetWidth - offsetX < 16 && offsetHeight - offsetY < 16;
  }

  get nodeData(): {
    _id?: string,
    type: NodeType,
    src: string,
    size: [number, number],
    text: string,
  } {
    return this.node.data as any;
  }

}
