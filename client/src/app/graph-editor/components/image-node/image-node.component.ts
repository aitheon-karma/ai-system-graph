import { InformationGraphNode } from '@aitheon/system-graph';
import { Coordinates, ModalService } from '@aitheon/core-client';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Renderer2,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  HostListener,
} from '@angular/core';
import {
  NodeService,
  NodeComponent as EditorNode,
} from '@aitheon/lib-graph-render-plugin';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ShowMoreMenuComponent } from '../../../shared/components/show-more-menu/show-more-menu.component';
import { SharedService } from '../../../shared/services/shared.service';
import { NodesService } from '../../shared/services/nodes.service';

enum Side {
  NW = 'NW',
  NE = 'NE',
  SE = 'SE',
  SW = 'SW',
}

const menuItems = [
  {
    label: 'Edit',
    key: 'EDIT',
  },
  {
    label: 'Remove',
    key: 'REMOVE',
  }
];

@Component({
  templateUrl: './image-node.component.html',
  styleUrls: ['./image-node.component.scss'],
  providers: [NodeService],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ImageNodeComponent extends EditorNode implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('showMoreMenu') private showMoreMenu: ShowMoreMenuComponent;

  private subscriptions$ = new Subscription();
  private _showMore$: BehaviorSubject<boolean>;
  private readonly minSize = 96;
  public showMoreItems: { label: string; key: string }[] = menuItems;
  public sides = Side;
  public isLoading: boolean;
  public isOptionsButtonVisible: boolean;
  public isEditMode: boolean;
  public isResizing: boolean;
  public resizingSide: Side;
  public resizeStartCoordinates: Coordinates;
  public resizeCurrentCoordinates: Coordinates;
  private startSize: [number, number];

  @HostListener('document:pointerup')
  onResizeEnd(): void {
    if (this.isResizing) {
      this.isResizing = false;
    }
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.isResizing) {
      this.resizeCurrentCoordinates = {
        x: event.clientX,
        y: event.clientY,
      };
      this.resizeImage();
      if (this.resizingSide !== Side.SE) {
        this.translateNode();
      }
    }
  }

  constructor(
    protected service: NodeService,
    protected cd: ChangeDetectorRef,
    protected renderer: Renderer2,
    private nodesService: NodesService,
    private modalService: ModalService,
    private sharedService: SharedService,
  ) {
    super(service, cd, renderer);
    this._showMore$ = new BehaviorSubject<boolean>(false);
  }

  ngOnInit(): void {
    this.onImageUpload();
    this.onNodeTranslate();
    if (!this.nodeData.image) {
      this.showMoreItems = [menuItems[1]];
    }
  }

  ngAfterViewInit(): void {
    if (this.nodeData?.image?.signedUrl) {
      this.isLoading = true;
    }
    this.onMouseLeave();
  }

  onMouseLeave(): void {
    this.subscriptions$.add(this.showMore$.pipe(
      distinctUntilChanged(),
      debounceTime(300),
    ).subscribe(opened => {
      if (!opened && this.showMoreMenu && !this.showMoreMenu.isOpened) {
        this.isOptionsButtonVisible = false;
        this.node.update();
      }
    }));
  }

  private onImageUpload(): void {
    this.subscriptions$.add(this.nodesService.onImageUpload(this.node.id as any).subscribe(file => {
      this.nodeData.image = file;
      this.isLoading = true;
      this.showMoreItems = menuItems;
      this.node.update();
      this.save();
    }));
  }

  private onNodeTranslate(): void {
    this.editor.on('nodetranslate', ({ source }) => {
      if (this.isResizing && source !== 'CODE') {
        return false;
      }
    });
  }

  public imageLoaded(): void {
    this.isLoading = true;
  }

  public selectImage(event: Event): void {
    this.stopEvent(event);

    this.nodesService.selectImage(this.node.id as any);
  }

  public saveChanges(event: Event): void {
    this.stopEvent(event);
    this.isEditMode = false;
    this.save();
  }

  onOptionsMenuAction(action: string): void {
    switch (action) {
      case 'REMOVE':
        this.remove();
        break;
      case 'EDIT':
        this.isEditMode = true;
        break;
    }
  }

  private remove(): void {
    this.modalService.openGenericConfirm({
      text: 'Are you sure you want to remove node?',
      headlineText: 'Node remove',
      callback: confirm => {
        if (confirm) {
          this.editor.removeNode(this.node);
          this.save();
        }
      }
    });
  }

  showOptionsMenuButton(): void {
    this._showMore$.next(true);
    this.isOptionsButtonVisible = true;
    this.node.update();
  }

  hideOptionsMenuButton(): void {
    this._showMore$.next(false);
  }

  openImagePreview() {
    this.sharedService.openNodeImage(this.nodeData?.image);
  }

  public resize(event: PointerEvent, side: Side): void {
    this.resizeStartCoordinates = {
      x: event.clientX,
      y: event.clientY,
    };
    this.startSize = [...this.nodeData.size] as any;
    this.resizingSide = side;
    this.isResizing = true;
  }

  private resizeImage(): void {
    const c = this.zoomCoefficient;
    const [width, height] = this.startSize;
    const deltaX = this.deltaRelative.x * c;
    const deltaY = this.deltaRelative.y * c;

    const updatedWidth = Math.round(width + deltaX);
    const updatedHeight = Math.round(height + deltaY);
    this.nodeData.size[0] = updatedWidth >= this.minSize ? updatedWidth : this.nodeData.size[0];
    this.nodeData.size[1] = updatedHeight >= this.minSize ? updatedHeight : this.nodeData.size[1];
  }

  private translateNode(): void {
    const { x, y, } = this.delta;
    this.editor.trigger('translatenode', {
      dx: this.resizingSide === Side.NE ? 0 : x,
      dy: this.resizingSide === Side.SW ? 0 : y,
      node: this.node,
      source: 'CODE',
    });
  }

  public get nodeData(): InformationGraphNode {
    return this.node.data as unknown as InformationGraphNode;
  }

  private get delta(): Coordinates {
    return {
      x: this.resizeCurrentCoordinates.x - this.resizeStartCoordinates.x,
      y: this.resizeCurrentCoordinates.y - this.resizeStartCoordinates.y,
    };
  }

  private get deltaRelative(): Coordinates {
    const { x, y } = this.delta;
    switch (this.resizingSide) {
      case Side.NW:
        return {
          x: x <= 0 ? Math.abs(x) : -x,
          y: y <= 0 ? Math.abs(y) : -y,
        };
      case Side.NE:
        return {
          x,
          y: y <= 0 ? Math.abs(y) : -y,
        };
      case Side.SW:
        return {
          x: x <= 0 ? Math.abs(x) : -x,
          y,
        };
      case Side.SE:
        return this.delta;
    }
  }

  private get zoomCoefficient(): number {
    const { k = 1 } = this.editor?.view?.area?.transform;
    return 1 / k;
  }

  get showMore$(): Observable<boolean> {
    return this._showMore$.asObservable();
  }

  save(): void {
    this.editor.trigger('save');
  }

  ngOnDestroy() {
    try {
      this.subscriptions$.unsubscribe();
    } catch (e) {
    }
    super.ngOnDestroy();
  }
}
