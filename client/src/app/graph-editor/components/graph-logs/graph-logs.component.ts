import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
} from '@angular/core';
import { Graph, GraphsRestService } from '@aitheon/system-graph';
import { Subscription, interval } from 'rxjs';
import { timeInterval, flatMap, takeWhile } from 'rxjs/operators';
import { GraphsService } from '../../../graphs/graphs.service';
import { GraphLog } from './graph-log.model';
import { ToastrService } from 'ngx-toastr';
import { LoggingProxyService } from '../../shared/services/logging-proxy.service';

@Component({
  selector: 'ai-graph-logs',
  templateUrl: './graph-logs.component.html',
  styleUrls: ['./graph-logs.component.scss']
})
export class GraphLogsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('logsContainer') logsContainer: ElementRef;

  loading = false;
  logsSubscription: Subscription;
  show = false;
  graph: Graph;
  logs: GraphLog[] = [] as GraphLog[];
  isRefreshing = false;
  total = 0;
  logsObserver: MutationObserver;
  nodeNamesMapping = {};
  maxShowLogs = 100;

  static isoDateToNumber(date: string): number {
    if (!date) { return null; }
    return Number(new Date(date));
  }


  constructor(
    private graphsRestService: GraphsRestService,
    private graphsService: GraphsService,
    private toastrService: ToastrService,
    private loggingProxyService: LoggingProxyService
  ) { }

  ngOnInit(): void {
    this.graphsService.onShowGraphBuild.subscribe((graph: Graph) => {
      this.graph = graph;
      if (this.graph) {
        this.toggleShow();
      }
    });

    this.loggingProxyService.onMessage.subscribe((event) => {
      this.loading = false;
      this.logs.push({ ...event, graphNodeName: this.nodeNamesMapping[event.graphNodeId] || '' });
      if (this.logs.length === this.maxShowLogs) {
        this.logs.shift();
      }
    });
  }

  ngAfterViewInit(): void {
    this.listenToLogsContentChange();
  }

  listenToLogsContentChange() {
    this.logsObserver = new MutationObserver(() => {
      this.logsContainer.nativeElement.scrollTop = this.logsContainer.nativeElement.scrollHeight;
    });
    this.logsObserver.observe(this.logsContainer.nativeElement, { childList: true });
  }

  getLogs() {
    if (this.graph) {
      // this.graphsRestService.getLogsByGraph(this.graph._id, this.total)
      //   .pipe(take(1))
      //   .subscribe((result: { data: GraphLog[], total: number }) => {
      //     this.processLogs(result);
      //   },
      //     (error: Error) => {
      //       this.toastrService.error(error.message || 'Unable to load logs.');
      //       this.loading = false;
      //     });
      this.graph.graphNodes.forEach((node) => {
        this.nodeNamesMapping[node._id] = node.graphNodeName;
      });
      this.graphsRestService.getLoggingProxy(this.graph._id).subscribe((result: { token: string }) => {
        this.loggingProxyService.connect(result.token);
      });
    }
  }

  toggleShow(event?: Event) {
    if (event) {
      this.stopEvent(event);
    }

    this.show = !this.show;
    if (this.show) {
      this.logs = [];
      this.loading = true;
      this.getLogs();
    } else {
      this.loggingProxyService.disconnect();
      if (this.isRefreshing) {
        this.isRefreshing = false;
      }
      if (this.logsSubscription) {
        try {
          this.logsSubscription.unsubscribe();
        } catch {}
      }
      this.graphsService.showGraphBuild(null);
    }
  }

  refresh(event: Event) {
    this.stopEvent(event);
    this.isRefreshing = !this.isRefreshing;
    if (this.isRefreshing) {
      const refreshInterval = interval(3 * 1000);
      this.logsSubscription = refreshInterval
        .pipe(
          timeInterval(),
          takeWhile(() => !!this.graph),
          flatMap(() => this.graphsRestService.getLogsByGraph(this.graph._id, this.total)))
        .subscribe((result: { data: GraphLog[], total: number }) => {
          this.processLogs(result);
        });
    } else {
      try {
        this.logsSubscription.unsubscribe();
      } catch {}
    }
  }

  processLogs(result: { data: GraphLog[], total: number }) {
    // tslint:disable-next-line:no-shadowed-variable
    this.logs = result.data.reduce((result, log: GraphLog) => {
      const graphNode = this.graph.graphNodes.find(node => node._id.toString() === log.graphNodeId.toString());
      return graphNode
        ? [
          ...result,
          { ...log, graphNode },
        ]
        : result;
    }, []).sort((previous, next) => {
      const previousTimestamp = GraphLogsComponent.isoDateToNumber(previous.timestamp);
      const nextTimestamp = GraphLogsComponent.isoDateToNumber(next.timestamp);
      return previousTimestamp - nextTimestamp;
    });

    this.loading = false;
  }

  onOutsideClick() {
    if (this.show) {
      this.toggleShow();
    }
  }

  stopEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  ngOnDestroy(): void {
    if (this.logsSubscription) {
      try {
        this.logsSubscription.unsubscribe();
      } catch {}
    }

    this.logsObserver.disconnect();
  }
}
