import {
  FunctionalNode,
  Graph,
  GraphsRestService, InformationGraphNode,
  NodesRestService,
  ServiceNode,
} from '@aitheon/system-graph';
import {
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormControl, FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { Subscription, forkJoin, of, Observable } from 'rxjs';
import { GraphsService } from '../../../graphs/graphs.service';
import { NODE_TEMPLATE } from '../../../nodes/node-details/node-template';
import { NodesService } from '../../shared/services/nodes.service';
import { GraphEditorService } from '../../shared/services/graph-editor.service';
import { ToastrService } from 'ngx-toastr';
import { ApplicationType, GraphType, NodeType } from '@aitheon/core-client';

enum GraphTabs {
  GENERAL = 'GENERAL',
  MY_NODES = 'MY_NODES',
  SERVICES = 'SERVICES',
  MARKETPLACE_NODES = 'MARKETPLACE_NODES',
  CORE_NODES = 'CORE_NODES',
  SUBGRAPH_TEMPLATES = 'SUBGRAPH_TEMPLATES',
}

enum ModelsTabs {
  MY_MODELS = 'MY_MODELS',
  MARKETPLACE_MODELS = 'MARKETPLACE_MODELS',
}

enum SubTabs {
  FUNCTIONAL = 'FUNCTIONAL',
  REQUESTED = 'REQUESTED',
}

interface Tab {
  key: string;
  label: string;
}

@Component({
  selector: 'ai-toolbox',
  templateUrl: './toolbox.component.html',
  styleUrls: ['./toolbox.component.scss'],
})
export class ToolboxComponent implements OnInit, OnDestroy {
  contentType: 'MODELS' | 'NODES';
  selectedNodeId: string;
  subscriptions: Subscription[] = [];
  activeSubscriptions: Subscription[] = [];
  graph: Graph;
  collection: any;
  viewCollection: any;
  addedServices: string[];
  activeTab: any;
  searchValue: any;
  searchControl: FormControl;
  loading = true;
  tabs: Tab[];
  tabTypes = {
    ...GraphTabs,
    ...ModelsTabs,
  };
  activeSubTab: SubTabs.FUNCTIONAL | SubTabs.REQUESTED;
  subTabs = Object.keys(SubTabs);
  servicesForm: FormGroup;
  itemType = {
    ...GraphType,
    ...NodeType,
  };
  public nodeTypes = NodeType;

  constructor(
    private nodesService: NodesService,
    private nodesRestService: NodesRestService,
    private graphEditorService: GraphEditorService,
    private graphsService: GraphsService,
    private graphsRestService: GraphsRestService,
    private toastr: ToastrService,
    private fb: FormBuilder,
    private router: Router,
  ) {}

  ngOnInit() {
    this.onShow();
    this.onNodeAdd();
  }

  onShow() {
    this.subscriptions.push(this.graphEditorService.onShowToolbox
      .subscribe(({ contentType, nodeId }) => {
        this.init(contentType, nodeId);
      }));
  }

  onNodeAdd(): void {
    this.subscriptions.push(this.graphEditorService.nodeAdded$
      .subscribe(node => {
        const graph = this.graphsService.getGraph();
        if (graph?.subType === Graph.SubTypeEnum.CONTROLLER && [GraphTabs.MARKETPLACE_NODES, GraphTabs.MY_NODES].includes(this.activeTab)) {
          this.viewCollection = this.viewCollection.filter(n => n._id !== node.data._id);
          this.collection = this.collection.filter(n => n._id !== node.data._id);
        }
      }));
  }

  init(contentType: 'NODES' | 'MODELS', nodeId?: string | null) {
    this.contentType = contentType;
    this.selectedNodeId = nodeId;

    this.initSearchControl();

    this.graph = this.graphsService.getGraph();
    this.setTabs();
    this.switchTab(this.contentType === 'NODES' ? GraphTabs.GENERAL : ModelsTabs.MY_MODELS);
  }

  getModels() {
    this.activeSubscriptions.push(this.nodesService.getModels().subscribe(models => {
        this.viewCollection = this.collection = models;
        this.loading = false;
      },
      (error: Error) => {
        this.toastr.error(error.message || 'Unable to load Models');
        this.loading = false;
      }));
  }

  initSearchControl() {
    this.searchControl = new FormControl();
    this.subscriptions.push(this.searchControl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
    ).subscribe(value => {
      this.viewCollection = this.collection.filter((item: any) => {
        const match = value && item.name.toLowerCase().includes(value.toLowerCase());
        if (this.activeTab !== GraphTabs.MY_NODES && this.activeTab !== GraphTabs.MARKETPLACE_NODES) {
          return !value
            ? true
            : match;
        }
        if (!value) {
          return this.activeSubTab === SubTabs.FUNCTIONAL
            ? !item.requested : item.requested;
        }
        return this.activeSubTab === SubTabs.FUNCTIONAL ?
          !item.requested && match : item.requested && match;
      });
    }));
  }

  setTabs() {
    const tabs: Tab[] = [];
    const createTab = tab => ({
      key: tab,
      label: tab.split('_').join(' ').toLowerCase(),
    });
    for (const tab of Object.keys(this.contentType === 'NODES' ? GraphTabs : ModelsTabs)) {
      if (tab === GraphTabs.SERVICES && this.graph.type === GraphType.CORE as string) {
        tabs.push(createTab(tab));
      } else if (tab !== GraphTabs.SERVICES && !(tab === GraphTabs.SUBGRAPH_TEMPLATES &&
        this.graph.type as any === GraphType.TEMPLATE)) {
        tabs.push(createTab(tab));
      }
    }
    this.tabs = tabs;
  }

  onDragStart(event: DragEvent, node: any) {
    const offset = {
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    };
    event.dataTransfer.setData('node', JSON.stringify(node));
    event.dataTransfer.setData('offset', JSON.stringify(offset));
  }

  switchTab(tab: string) {
    this.loading = true;
    this.activeTab = tab as any;
    this.activeSubTab = null;
    this.clearSearchInput();
    this.viewCollection = this.collection = [];
    this.servicesForm = null;
    this.unsubscribeFromSubscriptions(this.activeSubscriptions);

    switch (tab) {
      case GraphTabs.GENERAL:
        this.getGeneralTabContent();
        break;
      case GraphTabs.MY_NODES:
        this.getProjectsNodes('NODE', false);
        break;
      case GraphTabs.MARKETPLACE_NODES:
        this.getProjectsNodes('NODE', true);
        break;
      case GraphTabs.SERVICES:
        this.getServices();
        break;
      case GraphTabs.CORE_NODES:
        this.getCoreNodes();
        break;
      case GraphTabs.SUBGRAPH_TEMPLATES:
        this.getSubgraphs();
        break;
      case ModelsTabs.MY_MODELS:
      case ModelsTabs.MARKETPLACE_MODELS:
        this.getModels();
        break;
      default:
        break;
    }
  }

  switchSubTab(tab: string, event?: Event) {
    if (event) {
      this.stopEvent(event);
    }
    this.activeSubTab = tab as any;
    this.searchControl.reset();
    this.setSubCollection();
  }

  setSubCollection() {
    if (this.activeSubTab === SubTabs.FUNCTIONAL) {
      this.viewCollection = this.collection.filter(item => !item.requested);
    } else {
      this.viewCollection = this.collection.filter(item => item.requested);
    }
  }

  getGeneralTabContent() {
    const provisionalNode = this.createProvisionalNode();
    const textNode = this.createTextNode();
    const subgraph = this.createSubgraph();
    const imageNode = this.createImageNode();

    this.viewCollection = this.collection = [provisionalNode, subgraph, textNode, imageNode];
    this.loading = false;
  }

  getCoreNodes() {
    this.activeSubscriptions.push(this.nodesService.getCoreNodes()
      .pipe(switchMap(this.filterNodes.bind(this)))
      .subscribe((nodes: any) => {
          this.viewCollection = this.collection = nodes.filter(node => {
            if (node.type !== NodeType.CORE_NODE) {
              return false;
            }
            return node.runtime === this.graph.runtime;
          });
          this.loading = false;
        },
        (error: Error) => {
          this.toastr.error(error.message || 'Unable to load Core Nodes');
          this.loading = false;
        }));
  }

  getSubgraphs() {
    this.activeSubscriptions.push(this.graphsRestService.list()
      .subscribe((graphs: Graph[]) => {
          this.viewCollection = this.collection = graphs
            .filter(({ type }) => type as any === GraphType.TEMPLATE)
            .map(({
                    graphNodes,
                    subgraphNodes,
                    connections,
                    ...restGraph
                  }) => restGraph);
          this.loading = false;
        },
        (error: Error) => {
          this.toastr.error(error.message || 'Unable to load Subgraphs');
          this.loading = false;
        }));
  }

  getProjectsNodes(type: string, isPurchased: boolean) {
    this.activeSubTab = SubTabs.FUNCTIONAL;
    this.activeSubscriptions.push(this.nodesRestService.listProjectNodes(type, isPurchased)
      .pipe(switchMap(this.filterNodes.bind(this))).subscribe((nodes: any[]) => {
          this.viewCollection = this.collection = nodes;
          this.clearSearchInput();
          this.setSubCollection();
          this.loading = false;
        },
        (error: Error) => {
          this.toastr.error(error.message || `Unable to load ${isPurchased ? 'Purchased' : ''} Nodes`);
          this.loading = false;
        }));
  }

  filterNodes(nodes: FunctionalNode[]): Observable<FunctionalNode[]> {
    const graph = this.graphsService.getGraph();
    const resultNodes = nodes.filter(node => !(node.project as any)?.archived);
    if (graph?.subType === Graph.SubTypeEnum.CONTROLLER && [GraphTabs.MARKETPLACE_NODES, GraphTabs.MY_NODES].includes(this.activeTab)) {
      return this.graphEditorService.getGraphNodes().pipe(map(graphNodes => {
        const graphNodesIds = graphNodes.map(node => node.data._id);
        return resultNodes.filter(node => !graphNodesIds?.includes(node._id))
          .map(node => {
            if ((node?.project as any)?.projectSubType === ApplicationType.APPLICATION) {
              (node as any).device = graph.reference;
            }
            return node;
          });
      }));
    }

    return of(resultNodes);
  }

  getServices(): void {
    this.activeSubscriptions.push(forkJoin([
      // get latest version of current graph
      this.graphsRestService.getById(this.graph._id, true),
      this.nodesRestService.listServiceNodes(),
    ]).pipe(map(([currentGraph, nodes]) => {
      this.graph = currentGraph;
      this.addedServices = currentGraph.subgraphNodes
        .filter(({ graph }) => !!graph.service && !graph.disabled)
        .map(({ graph }) => graph.service);
      return nodes;
    })).subscribe((nodes: ServiceNode[]) => {
      this.initServicesForm(nodes);
      this.loading = false;
    }));
  }

  initServicesForm(nodes: ServiceNode[]): void {
    this.servicesForm = this.fb.group({
      services: this.fb.array(nodes.map(node => {
        const serviceControl = this.fb.group({
          name: [node.service],
          enabled: [this.addedServices.includes(node.service)],
        });
        this.activeSubscriptions.push(serviceControl.valueChanges.subscribe(value => {
          this.toggleService(value);
        }));
        return serviceControl;
      })),
    });
  }

  toggleService(value: { name: string, enabled: string }) {
    this.graphsRestService.toggleCoreServiceGraph({ service: value.name })
      .subscribe(() => {
        this.graphsService.onTriggerReload();
      });
  }

  createProvisionalNode() {
    return {
      ...NODE_TEMPLATE,
      templateVariables: {
        ...NODE_TEMPLATE.templateVariables,
        inference: {
          ...NODE_TEMPLATE.templateVariables.inference,
          enabled: true,
        },
        training: {
          ...NODE_TEMPLATE.templateVariables.training,
          enabled: true,
        },
        settings: {
          ...NODE_TEMPLATE.templateVariables.settings,
          mapping: {
            ...NODE_TEMPLATE.templateVariables.settings.mapping,
            enabled: true,
          },
          ticks: [
            {
              enabled: false,
              name: 'Example Tick 1',
              interval: 1000,
            },
            {
              enabled: true,
              name: 'Example Tick 2',
              interval: 3000,
            },
          ],
          parameters: [],
        },
      },
      inputs: [],
      outputs: [],
      name: 'Provisional Node',
      type: NodeType.TEMPLATE_NODE,
    } as unknown as FunctionalNode;
  }

  get servicesControlsArray(): FormArray {
    if (this.servicesForm) {
      return this.servicesForm.get('services') as FormArray;
    }
  }

  createTextNode() {
    return {
      type: NodeType.TEXTAREA,
      name: 'Text Box',
      text: '',
    };
  }

  private createImageNode(): InformationGraphNode {
    return {
      type: InformationGraphNode.TypeEnum.IMAGE,
      name: 'Image',
      size: [124, 80],
    } as InformationGraphNode;
  }

  createSubgraph() {
    return {
      name: 'Subgraph',
      type: GraphType.SUBGRAPH,
      inputs: [],
      outputs: [],
    } as Graph;
  }

  clearSearchInput(event?: Event) {
    if (event) {
      this.stopEvent(event);
    }

    this.searchControl.setValue(null);
  }

  onCloseToolbox(event?: Event) {
    if (event) {
      this.stopEvent(event);
    }
    this.contentType = null;
    this.collection = null;
    this.viewCollection = null;
    this.graphEditorService.hideToolbox();
  }

  onAddModel(event: Event, model: any) {
    this.stopEvent(event);
    this.nodesService.addModel(model, this.selectedNodeId);
  }

  goToSubgraph(event: Event, id?: string) {
    this.stopEvent(event);

    const backUrl = encodeURIComponent(this.router.url);
    this.router.navigate(id ? ['/', 'graphs', 'update', id] : ['/', 'graphs', 'create'], {
      queryParams: {
        backUrl,
      },
    });
  }

  onClickOutside() {
    if (this.contentType) {
      this.onCloseToolbox();
    }
  }

  stopEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  goToMarketplace(event: Event) {
    this.stopEvent(event);

    window.location.href = `/marketplace/store/items?type=${this.contentType === 'MODELS' ? 'MODEL' : 'NODE'}`;
  }

  unsubscribeFromSubscriptions(subscriptions: Subscription[]) {
    for (const subscription of subscriptions) {
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch {
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeFromSubscriptions(this.subscriptions);
    this.unsubscribeFromSubscriptions(this.activeSubscriptions);
  }
}
