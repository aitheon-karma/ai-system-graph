import { GraphRefType } from '@aitheon/core-client';
import { InfrastructureRestService } from '@aitheon/smart-infrastructure';
import { FileItem, FunctionalNode, Node, NodesRestService, ServiceGraph } from '@aitheon/system-graph';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject, Subscription } from 'rxjs';

import { filter, map, switchMap, tap, catchError } from 'rxjs/operators';
import { GraphsService } from '../../../graphs/graphs.service';
import { ConnectionPickData } from '../../../shared/interfaces/connection-pick-data.interface';
import { NodeReference } from '../../../shared/interfaces/node-reference.interface';
import { OrganizationsService } from '../../../shared/services/organizations.service';

export interface ActiveIo {
  node: any;
  type: 'input' | 'output';
  key: string;
}

@Injectable({
  providedIn: 'root',
})
export class NodesService implements OnDestroy {
  private subscriptions$ = new Subscription();
  private _nodesReferences$ = new BehaviorSubject<NodeReference[]>(null);
  private _connectionPick$ = new Subject<ConnectionPickData>();
  private _mappingConnectionsDrop$ = new Subject<void>();
  private _openFileUploader$ = new Subject<{ nodeId: string }>();
  private _fileUploaded$ = new Subject<{
    nodeId: string;
    file: FileItem;
  }>();
  private coreNodes: any;
  private activeIo: ActiveIo = null;
  public modelsChanged = new Subject<any>();
  public modelAdded = new Subject<{ model: any, nodeId: string }>();
  public updateReteEditor = new Subject<any>();
  public openNodeModal = new Subject<{
    type: string,
    data: any,
    callback: any,
  }>();

  public editorSizeChanged = new BehaviorSubject<number>(0);
  public nodesFetched = new BehaviorSubject<Node[]>([]);

  public get nodesReferences$(): Observable<NodeReference[]> {
    return this._nodesReferences$.asObservable();
  }

  public get connectionPick$(): Observable<ConnectionPickData> {
    return this._connectionPick$.asObservable();
  }

  public get mappingConnectionsDrop$(): Observable<void> {
    return this._mappingConnectionsDrop$.asObservable();
  }

  public get openFileUploader$(): Observable<{ nodeId: string }> {
    return this._openFileUploader$.asObservable();
  }

  public get fileUploaded$(): Observable<{ nodeId: string; file: FileItem }> {
    return this._fileUploaded$.asObservable();
  }

  constructor(
    private graphsService: GraphsService,
    private nodesRestService: NodesRestService,
    private organizationsService: OrganizationsService,
    private infrastructureRestService: InfrastructureRestService,
  ) {
    this.subscriptions$.add(organizationsService.currentOrganization$.subscribe(() => {
      organizationsService.setHeaders(infrastructureRestService);
      this.getGraphReferences();
    }));
  }

  private getGraphReferences(): void {
    this.subscriptions$.add(this.graphsService.graphChanged$.pipe(
      filter(g => g && ((g as ServiceGraph)?.service === 'SMART_INFRASTRUCTURE' || (g as any)?.reference)),
      map(graph => {
        let referenceType: GraphRefType;
        let reference: string;
        if ((graph as ServiceGraph).service) {
          referenceType = GraphRefType.SERVICE;
        } else {
          referenceType = graph.subType as any;
          reference = graph.reference ? (graph.reference as any)._id || graph.reference : graph.reference;
        }
        return { reference, referenceType };
      }),
      switchMap(({ referenceType, reference }) => this.infrastructureRestService.listGraphReferences(referenceType, reference)),
      map(references => {
        let result = [];
        if (references) {
          for (const referencesArray of Object.values(references)) {
            result = [...result, ...referencesArray];
          }
        }
        return result;
      }),
      catchError(() => of(null)),
    ).subscribe((references: NodeReference[]) => {
      this._nodesReferences$.next(references);
    }));
  }

  public getNodeReference(referenceId: string): Observable<NodeReference> {
    return this.nodesReferences$.pipe(
      filter(r => !!r),
      map(references => references.find(({ _id }) => _id === referenceId)));
  }

  public getModels() {
    // TODO rework when node models will be ready.
    return of([]);
  }

  public onOpenNodeModal(type: string, data: any, callback: any) {
    this.openNodeModal.next({
      type,
      data,
      callback,
    });
  }

  public getCoreNodes() {
    if (this.coreNodes) {
      return new Observable(subscriber => subscriber.next(this.coreNodes));
    }
    return this.nodesRestService.list()
      .pipe(tap(nodes => {
        this.nodesFetched.next(nodes);
      }));
  }

  public addModel(model: any, nodeId: string) {
    this.modelAdded.next({ model, nodeId });
  }

  public createNode(node: FunctionalNode) {
    return this.nodesRestService.create(node);
  }

  public updateNode(node: FunctionalNode, id: string) {
    return this.nodesRestService.update(id, node);
  }

  public removeNode(nodeId: string) {
    this.nodesRestService.removeById(nodeId).subscribe(() => {
    });
  }

  public updateEditorView(node: any) {
    this.updateReteEditor.next(node);
  }

  public onChangeEditorHeight(height: number) {
    this.editorSizeChanged.next(height);
  }

  public setActiveIo(io: ActiveIo) {
    this.activeIo = io;
  }

  public clearActiveIo() {
    this.activeIo = null;
  }

  public getActiveIo() {
    return this.activeIo;
  }

  public connectionPicked(data: ConnectionPickData): void {
    data.picked = true;
    this._connectionPick$.next(data);
  }

  public connectionDropped(data: ConnectionPickData = {
    ioType: null,
    socket: null,
    nodeId: null,
  }): void {
    data.picked = false;
    this._connectionPick$.next(data);
  }

  public onImageUpload(nodeId: string): Observable<FileItem> {
    return this.fileUploaded$.pipe(
      filter(d => d?.nodeId === nodeId),
      map(d => d.file),
    );
  }

  public fileUploaded(nodeId: string, file: FileItem): void {
    this._fileUploaded$.next({ nodeId, file });
  }

  public dropMappingConnections(): void {
    this._mappingConnectionsDrop$.next();
  }

  public selectImage(nodeId: string): void {
    this._openFileUploader$.next({ nodeId });
  }

  ngOnDestroy(): void {
    try {
      this.subscriptions$.unsubscribe();
    } catch (e) {
    }
  }
}
