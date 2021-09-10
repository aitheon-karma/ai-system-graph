import { Graph, GraphsRestService, ServiceGraph } from '@aitheon/system-graph';
import { AuthService, GraphType } from '@aitheon/core-client';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { take, switchMap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'ai-applications-dashboard',
  templateUrl: './applications-dashboard.component.html',
  styleUrls: ['./applications-dashboard.component.scss'],
})
export class ApplicationsDashboardComponent implements OnInit, OnDestroy {
  subscription$: Subscription;
  currentOrganization: any;
  graphNodeId: string;
  application: any;
  isLoading = true;
  graphUrl: string;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastr: ToastrService,
    private graphRestService: GraphsRestService
  ) {}

  ngOnInit(): void {
    this.subscription$ = this.authService.activeOrganization.pipe(
      take(1),
      switchMap(() => this.route.params),
      switchMap(({ graphNodeId }) => {
        this.graphNodeId = graphNodeId;
        return this.graphRestService.getByGraphNodeId(graphNodeId);
      })).subscribe((graph: Graph) => {
      const graphNode: any = graph.graphNodes.find(g => g._id === this.graphNodeId);
      if (graphNode) {
        const project = graphNode.node.project;
        const isServiceGraph = graph.type === GraphType.SERVICE;

        this.graphUrl = `/system-graph/graphs/organization/service/${isServiceGraph
          ? (graph as ServiceGraph).service
          : project?.meta?.initiatorService}${isServiceGraph ? '' : `/sub-graph/${graph._id}`}`;

        this.application = {
          graphNodeId: this.graphNodeId,
          status: graphNode.status,
          project,
          isLatest: graphNode.isLatest,
        };
      }

      this.isLoading = false;
    }, error => {
      this.toastr.error(error?.message || 'Unable to load application');
      this.isLoading = false;
    });
  }

  ngOnDestroy(): void {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }
}
