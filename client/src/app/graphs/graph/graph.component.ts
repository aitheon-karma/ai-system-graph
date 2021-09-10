import { ApplicationBuildService, AuthService, GraphType } from '@aitheon/core-client';
import { ItemRestService } from '@aitheon/item-manager';
import {
  Graph,
  GraphConnection,
  GraphNode,
  GraphsRestService,
  LinkedGraph,
  ServiceGraph,
  ServiceGraphNode,
} from '@aitheon/system-graph';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { forkJoin, Observable, Subscription } from 'rxjs';
import { debounceTime, take, tap } from 'rxjs/operators';
import { GraphEditorService } from 'src/app/graph-editor/shared/services/graph-editor.service';
import { environment } from '../../../environments/environment';
import { GraphEditorComponent } from '../../graph-editor/graph-editor.component';
import { SocketsService } from '../../graph-editor/shared/services/sockets.service';
import { GraphsService } from '../graphs.service';

interface NavigationItem {
  name: string;
  type: GraphType;
  _id: string;
  service?: string;
}

@Component({
  selector: 'ai-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss'],
})
export class GraphComponent implements OnInit, OnDestroy {
  @ViewChild('graphEditor') graphEditor: GraphEditorComponent;

  routeParamsSubscription: Subscription;
  subscriptions$: Subscription[] = [];
  loading: boolean;
  running = false;
  serviceId: string;
  serviceItemId: string;
  subGraphId: string;
  subGraphTemplateId: string;
  graph: Graph;
  currentOrg: any;
  isSysAdmin: boolean;
  navigationItems: NavigationItem[];
  showBuildLogsButton = false;
  isSubGraphTemplate: boolean;
  submitted: boolean;
  templateCreated: boolean;
  graphDeploying: boolean;
  graphLoadingType: 'DEPLOY' | 'STOP';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private graphsRestService: GraphsRestService,
    private itemRestService: ItemRestService,
    private socketsService: SocketsService,
    private graphsService: GraphsService,
    private graphEditorService: GraphEditorService,
    private applicationBuildService: ApplicationBuildService,
    private router: Router,
    public toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.routeParamsSubscription = this.route.params.pipe(tap(() => {
      this.unsubscribeFromSubscriptions();
    })).subscribe(({ serviceId, itemId, subGraphId, subGraphTemplateId }) => {
      this.onNodeAppBuildFinish();
      this.loading = true;
      this.serviceId = serviceId;
      this.serviceItemId = itemId;
      this.subGraphId = subGraphId;
      this.subGraphTemplateId = subGraphTemplateId;

      this.subscriptions$.push(this.getCurrentOrganization().subscribe(() => {
        this.getGraph();
      }));

      this.subscriptions$.push(this.authService.currentUser.subscribe((user: any) => {
        if (user.sysadmin) {
          this.isSysAdmin = true;
        }
      }));

      this.listenToGraphLogsToggle();
      this.listenToAutoSave();
      this.listenToReload();
    });
  }

  unsubscribeFromSubscriptions() {
    for (const subscription$ of this.subscriptions$) {
      try {
        subscription$.unsubscribe();
      } catch (e) {
      }
    }
    this.subscriptions$ = [];
  }

  getCurrentOrganization() {
    return this.authService.activeOrganization.pipe(
      take(1),
      tap(org => {
        this.currentOrg = org;
        this.setNavigation();
        this.graphsService.setOrganization(this.currentOrg);
        if (!environment.production && org) {
          this.itemRestService.defaultHeaders = this.itemRestService.defaultHeaders.set('organization-id', org._id);
        }
      }));
  }

  getGraph() {
    let requestName: string;
    let query: any;
    const params: any[] = [];

    if (this.subGraphId || this.subGraphTemplateId) {
      requestName = 'getById';
      query = this.subGraphId || this.subGraphTemplateId;
      params.push(true);
    }
    if (this.serviceId && !this.subGraphId && !this.isCoreGraphChild) {
      if (this.serviceItemId) {
        requestName = 'getBySearch';
        query = {
          item: this.serviceItemId,
          service: this.serviceId
        };
      } else {
        requestName = 'getByService';
        query = this.serviceId;
      }
    }
    if (this.isOrganizationGraph) {
      requestName = 'getOrganizationGraph';
    }

    if (this.isCoreGraph) {
      requestName = 'getCoreGraph';
    }

    if (this.isCoreGraphChild && this.serviceId && !this.subGraphId) {
      requestName = 'getBySearch';
      query = {
        service: this.serviceId,
        core: true,
      };
    }

    if (!requestName && !query) {
      this.loadEmptyGraphData();
      this.listenToSubGraphFormChange();
      return;
    }


    forkJoin([
      this.graphsRestService[requestName](query, ...params),
      this.socketsService.setSockets(),
    ]).pipe(take(1)).subscribe(([graph]: [Graph, any]) => {
        if (graph.organization !== this.currentOrg?._id) {
          this.navigateToOrgGraph();
          return;
        }
        this.setGraphProperties(graph as any);
      },
      (error: Error) => {
        this.toastr.error(error.message);
      });
  }

  setGraphProperties(graph: ServiceGraph) {
    if (!graph) {
      this.toastr.error('Unable to load graph');
      this.loading = false;
      return;
    }
    if (this.serviceId && graph.disabled) {
      this.toastr.error('Service is disabled!');
      this.navigateToOrgGraph();
    }

    this.graph = graph;
    this.graphsService.setGraph(this.graph);

    if (this.subGraphTemplateId) {
      this.isSubGraphTemplate = true;
      this.listenToSubGraphFormChange();
    }
    const editorData = this.graphsService.createEditorDataFromGraph(this.graph);
    this.graphEditorService.updateEditorData(editorData);
    this.graphEditorService.addInformationNodes(this.graph.informationNodes);
    this.setNavigation();
    this.loading = false;
  }

  setNavigation(): void {
    this.navigationItems = [];
    if (this.graph && (this.graph?.type !== GraphType.ORGANIZATION && (this.graph as any)?.type !== GraphType.CORE)) {
      this.subscriptions$.push(this.graphsRestService.getBreadcrumbsByGraph(this.graph._id).subscribe(breadcrumbs => {
        if (breadcrumbs && breadcrumbs[0]) {
          const [graphHierarchyObject] = breadcrumbs;
          const { graphHierarchy } = graphHierarchyObject || {};
          this.navigationItems = graphHierarchy || [];
          if (!this.graph.parent) {
            this.navigationItems = [{
              name: 'Organization Graph',
              type: GraphType.ORGANIZATION,
            } as NavigationItem];
          }
        }
      }));
    }
  }

  goToParentGraph(event: Event, navigationItem: NavigationItem): void {
    this.stopEvent(event);
    const isCoreChild = this.navigationItems?.find(({ type }) => type === GraphType.CORE);
    const mainGraphPath = isCoreChild ? 'core' : 'organization';
    let pathToNavigate = ['/', 'graphs', 'organization'];
    switch (navigationItem.type) {
      case GraphType.SUBGRAPH:
      case GraphType.LINKED:
        pathToNavigate = ['/', 'graphs', mainGraphPath, 'sub-graph', navigationItem._id];
        break;
      case GraphType.SERVICE:
        pathToNavigate = ['/', 'graphs', mainGraphPath, 'service', navigationItem.service];
        break;
      case GraphType.CORE:
      case GraphType.ORGANIZATION:
        pathToNavigate = ['/', 'graphs', mainGraphPath];
        break;
    }

    this.router.navigate(pathToNavigate);
  }

  saveGraph(event?: Event): void {
    if (event) {
      this.stopEvent(event);
    }

    if (this.isSubGraphTemplate) {
      this.submitted = true;
      if (!this.graph || !this.graph.name || !this.graph.runtime) {
        return;
      }
    }

    const editorData = this.graphEditor && this.graphEditor.getEditorData();
    if (!editorData) {
      return;
    }

    let parsedEditorData;
    if (!this.isOrganizationGraph) {
      parsedEditorData = this.graphsService.parseSubGraphEditorData(editorData);
    } else {
      parsedEditorData = this.graphsService.parseEditorData(editorData);
    }

    if (!parsedEditorData) {
      return;
    }

    if (this.isSubGraphTemplate && !this.subGraphTemplateId && !this.templateCreated) {
      const { serviceGraphNode, ...subGraphTemplateData } = parsedEditorData;
      this.createGraph(subGraphTemplateData);
      return;
    }

    this.subscriptions$.push(this.updateGraph(parsedEditorData, this.graphsService.reloadOnSave).subscribe((updatedGraph: Graph) => {
        if (this.graphsService.reloadOnSave) {
          this.setGraphProperties(updatedGraph as any);
          this.graphsService.reloadOnSave = false;
        }
      },
      (error: any) => {
        this.toastr.error(error.error ? error.error.message : 'Unable to save graph!');
      }));
  }

  updateGraph(graphData: {
    connections: GraphConnection[],
    graphNodes: GraphNode[],
    serviceGraphNode?: ServiceGraphNode,
  }, populate: boolean = false): Observable<Graph> {
    const { serviceGraphNode, ...restGraphData } = graphData;
    let graph;
    if (this.graph.type === GraphType.SERVICE) {
      graph = {
        ...this.graph,
        ...graphData,
      };
    } else {
      graph = {
        ...this.graph,
        ...restGraphData,
      };
    }

    if (this.graph.type as any === GraphType.TEMPLATE) {
      return this.graphsRestService.updateTemplate(this.graph._id, graph);
    }
    return this.graphsRestService.update(this.graph._id, graph, populate);
  }

  onNodeAppBuildFinish(): void {
    this.subscriptions$.push(this.applicationBuildService.buildFinished$.subscribe(() => {
      this.getGraph();
    }));
  }

  navigateToOrgGraph() {
    this.router.navigate(['/', 'graphs', 'organization']);
  }

  navigateToCoreGraph() {
    this.router.navigate(['/', 'graphs', 'core']);
  }

  showGraphBuild(event: Event) {
    this.stopEvent(event);

    this.graphsService.showGraphBuild(this.graph);
  }

  /** SUBGRAPH SECTION */

  loadEmptyGraphData() {
    this.subscriptions$.push(this.socketsService.setSockets().subscribe(() => {
      const graphTemplate = this.graph = this.graphsService.subGraphTemplate;
      this.graphsService.setGraph(this.graph);
      this.graphEditorService.updateEditorData(this.graphsService.createEditorDataFromGraph(graphTemplate));
      this.loading = false;
      this.isSubGraphTemplate = true;
    }));
  }

  listenToSubGraphFormChange() {
    this.subscriptions$.push(this.graphsService.graphTemplateFormChanged
      .subscribe((formValue: { name: string, runtime: string }) => {
        this.graph = {
          ...(this.graph || {}),
          ...formValue,
        } as Graph;

        this.graphsService.setGraph(this.graph);
      }));
  }

  getRoutes() {
    try {
      const isOrgGraphChild = this.router.url.includes('organization') || this.router.url.includes('/core');
      const routesKey = isOrgGraphChild ? this.currentOrg._id : this.serviceId;
      return [JSON.parse(localStorage.getItem(routesKey)), routesKey];
    } catch (e) {
      return [];
    }
  }

  createGraph(graphData: {
    connections: GraphConnection[],
    graphNodes: GraphNode[],
  }) {
    const graph = {
      ...this.graph,
      ...graphData,
    } as Graph;

    this.subscriptions$.push(this.graphsRestService.create(graph)
      .subscribe((createdGraph: Graph) => {
          this.toastr.success('Subgraph successfully created!');
          this.graph = createdGraph;
          this.templateCreated = true;
        },
        (error: Error) => {
          this.toastr.error(error.message || 'Unable to save graph!');
        },
      ));
  }

  navigateBackToGraph(event: Event) {
    this.stopEvent(event);

    const backUrlUri = this.route.snapshot.queryParams['backUrl'];
    const backUrl = decodeURIComponent(backUrlUri);

    this.templateCreated = false;
    this.router.navigate([backUrl]);
  }

  editSubgraphTemplate(event: Event) {
    this.stopEvent(event);

    if ((<LinkedGraph>this.graph).ref) {
      const backUrl = encodeURIComponent(this.router.url);
      this.router.navigate(['/', 'graphs', 'update', (<LinkedGraph>this.graph).ref], {
        queryParams: {
          backUrl,
        },
      });
      return;
    }
    this.toastr.error('Unable to edit subgraph!');
  }

  unlinkGraph(event: Event) {
    this.stopEvent(event);
    this.subscriptions$.push(this.graphsRestService.update(this.graph._id, {
      ...this.graph,
      type: GraphType.SUBGRAPH,
      ref: undefined,
    }).subscribe((unlinkedGraph: Graph) => {
        this.graph = unlinkedGraph;
        this.graphsService.setGraph(this.graph);

        this.toastr.success('Graph successfully unlinked!');
      },
      (error: Error) => {
        this.toastr.error(error.message || 'Unable to unlink graph!');
      }));
  }

  /** END OF SUBGRAPH SECTION */

  stopEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  toggleRun(type: string, event?: Event) {
    if (event) {
      this.stopEvent(event);
    }
    this.graphDeploying = true;
    this.graphLoadingType = type === 'START' ? 'DEPLOY' : 'STOP';
    let timeout = setTimeout(() => {
      this.graphDeploying = false;
      this.toastr.success(this.graphLoadingType === 'DEPLOY' ? 'Graph successfully deployed!' : 'Graph successfully stopped!');
      this.loading = true;
      this.getGraph();

      clearTimeout(timeout);
      timeout = null;
    }, 5800);
    if (type === 'START') {
      this.deployGraph(timeout);
    } else if (type === 'STOP') {
      this.stopGraph(timeout);
    }
  }

  deployGraph(timeout): void {
    const request$ = this.graph.type === GraphType.ORGANIZATION
      ? this.graphsRestService.deployGraph()
      : this.graphsRestService.deploySubGraph(this.graph._id);
    this.subscriptions$.push(request$.subscribe((result) => {},
      error => {
        if (timeout) {
          clearTimeout(timeout);
        }
        this.toastr.error(error?.message || this.graphLoadingType === 'DEPLOY'
          ? 'Unable to deploy graph...' : 'Unable to stop graph...');
      }));
  }

  stopGraph(timeout): void {
    const request$ = this.graph.type === GraphType.ORGANIZATION
      ? this.graphsRestService.stopGraph()
      : this.graphsRestService.stopSubGraph(this.graph._id);
    this.subscriptions$.push(request$.subscribe((result) => {},
      error => {
        if (timeout) {
          clearTimeout(timeout);
        }
        this.toastr.error(error?.message || this.graphLoadingType === 'DEPLOY'
          ? 'Unable to deploy graph...' : 'Unable to stop graph...');
      }));
  }

  listenToAutoSave() {
    this.subscriptions$.push(this.graphsService.saveTriggered.pipe(
      debounceTime(600),
    ).subscribe(() => {
      if (this.isSubGraphTemplate && !this.subGraphTemplateId && !this.templateCreated) {
        return;
      }
      this.saveGraph();
    }));
  }

  listenToReload() {
    this.subscriptions$.push(this.graphsService.triggerReload.subscribe(() => {
      this.getGraph();
    }));
  }

  listenToGraphLogsToggle() {
    this.subscriptions$.push(this.graphsService.onShowGraphBuild.subscribe((graph: Graph) => {
      this.showBuildLogsButton = !graph;
    }));
  }

  public get readonly() {
    return this.graphsService.graphType === GraphType.LINKED;
  }

  get isOrganizationGraph() {
    return this.router.url === '/graphs/organization';
  }

  get isCoreGraph() {
    return this.router.url === '/graphs/core';
  }

  get isCoreGraphChild() {
    return !this.isCoreGraph && this.router.url.includes('graphs/core');
  }

  get parentName() {
    if (this.graph && this.graph.type === GraphType.SERVICE) {
      return `${this.currentOrg.name} organization`;
    }
    return this.formattedGraphName;
  }

  get formattedGraphName() {
    const graph = this.graph as any;
    let graphName = '';
    if (this.serviceId) {
      graphName = this.serviceId;
    }
    if (this.subGraphId) {
      graphName = graph?.reference?.name ? graph.reference.name : graph?.name;
    }
    if ([GraphType.ORGANIZATION, GraphType.CORE].includes(graph?.type)) {
      graphName = `${this.currentOrg ? this.currentOrg.name : ''} ${this.isCoreGraph ? 'core graph' : 'organization'}`;
    }
    return graphName;
  }

  ngOnDestroy(): void {
    try {
      this.routeParamsSubscription.unsubscribe();
      this.unsubscribeFromSubscriptions();
    } catch {
    }
  }
}
