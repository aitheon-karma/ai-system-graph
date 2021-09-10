import { ModalService } from '@aitheon/core-client';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Renderer2,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  NgZone,
} from '@angular/core';
import {
  NodeService,
  NodeComponent as EditorNode,
} from '@aitheon/lib-graph-render-plugin';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ShowMoreMenuComponent } from '../../../shared/components/show-more-menu/show-more-menu.component';
import { MappingModalData } from '../../../shared/interfaces/mapping-modal-data.interface';
import { SharedService } from '../../../shared/services/shared.service';
import { GraphEditorService } from '../../shared/services/graph-editor.service';
import { NodesService } from '../../shared/services/nodes.service';

@Component({
  templateUrl: './mapping-node.component.html',
  styleUrls: ['./mapping-node.component.scss'],
  providers: [NodeService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MappingNodeComponent extends EditorNode implements AfterViewInit, OnDestroy {
  @ViewChild('showMoreMenu') private showMoreMenu: ShowMoreMenuComponent;

  private subscriptions$ = new Subscription();
  private _showMore$: BehaviorSubject<boolean>;
  public isOptionsButtonVisible: boolean;
  public isDragging: boolean;
  public showMoreItems = [
    {
      label: 'Open Mapping Modal',
      key: 'MAPPING',
    },
    {
      label: 'Remove',
      key: 'REMOVE',
    }
  ];

  constructor(
    protected service: NodeService,
    protected cd: ChangeDetectorRef,
    protected renderer: Renderer2,
    private modalService: ModalService,
    private nodesService: NodesService,
    private graphEditorService: GraphEditorService,
    private ngZone: NgZone,
  ) {
    super(service, cd, renderer);
    this._showMore$ = new BehaviorSubject<boolean>(false);
  }

  ngAfterViewInit(): void {
    this.onMouseLeave();
    this.node.update();
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

  showOptionsMenuButton(): void {
    this._showMore$.next(true);
    this.isOptionsButtonVisible = true;
    this.node.update();
  }

  hideOptionsMenuButton(): void {
    this._showMore$.next(false);
  }

  onOptionsMenuAction(action: string): void {
    this.runInNgZone(() => {
      switch (action) {
        case 'REMOVE':
          this.remove();
          break;
        case 'MAPPING':
          this.openMappingModal();
          break;
      }
    });
  }

  openMappingModal(): void {
    this.modalService.openModal('MAPPING_MODAL', { node: this.node, isExist: true } as MappingModalData);
  }

  remove(): void {
    this.modalService.openGenericConfirm({
      text: 'Are you sure you want to remove node?',
      headlineText: 'Node remove',
      callback: confirm => {
        if (confirm) {
          this.editor.removeNode(this.node);
          this.nodesService.connectionDropped();
          this.save();
        }
      }
    });
  }

  get showMore$(): Observable<boolean> {
    return this._showMore$.asObservable();
  }

  save(): void {
    this.editor.trigger('save');
  }

  private runInNgZone(call: () => any): void {
    this.ngZone.run(call);
  }

  ngOnDestroy() {
    try {
      this.subscriptions$.unsubscribe();
    } catch (e) {
    }
    super.ngOnDestroy();
  }
}
