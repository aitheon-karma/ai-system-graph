import { NodesRestService } from '@aitheon/system-graph';
import { Component, OnInit, ViewChild, } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { GroupModalComponent } from '../group-modal/group-modal.component';

@Component({
  selector: 'ai-nodes-dashboard',
  templateUrl: './nodes-dashboard.component.html',
  styleUrls: ['./nodes-dashboard.component.scss']
})
export class NodesDashboardComponent implements OnInit {
  @ViewChild('groupModal') groupModal: GroupModalComponent;

  groups: any;
  nodes: any;
  mode: string;
  selectedNodeId: string;
  selectedNode: any;
  selectedGroup: any;
  selectedGroupId: string;

  constructor(
    private nodesRestService: NodesRestService,
    private toastr: ToastrService,
  ) {}

  ngOnInit() {
    this.nodesRestService.listGroups()
      .subscribe(groups => {
        this.groups = groups;
      });
  }

  /** GROUPS SECTION */
  showModal() {
    this.groupModal.show();
  }

  onGroupEdit(group) {
    this.groupModal.show(group);
  }

  onGroupSelect(groupId) {
    this.selectedGroupId = groupId;
    this.selectedGroup = this.groups.find(({ _id }) => _id === groupId);
    this.selectedNodeId = null;
    this.mode = null;

    this.nodesRestService.listByGroup(groupId)
      .subscribe(nodes => {
        this.nodes = nodes.filter(node => node.type !== 'SUBGRAPH_NODE');
      });
  }

  onGroupRemove(id: string) {
    if (id) {
      this.nodesRestService.removeGroupById(id)
        .subscribe(() => {
          this.groups = this.groups.filter(({ _id }) => _id !== id);
          this.nodes = null;
          this.selectedNode = null;
          this.selectedNodeId = null;
          this.toastr.success('Group successfully deleted!');
        });
    }
  }

  onGroupSave(group: any) {
    const { _id, ...restGroup } = group;
    if (_id) {
      this.nodesRestService.updateGroup(_id, restGroup)
        .subscribe(response => {
          this.groups = this.groups.map(item => {
            if (item._id === _id) {
              return response;
            }
            return item;
          });
        });
      return;
    }

    this.nodesRestService.createGroup(restGroup)
      .subscribe(response => {
        this.groups.push(response);
      });
  }

  /** NODES SECTION */
  onNodeAdd() {
    this.mode = 'ADD';
  }

  onNodeSave(node: any) {
    const { _id, ...restNode } = node;
    if (_id) {
      this.nodesRestService.update(_id, restNode)
        .subscribe(response => {
          this.nodes = this.nodes.map(item => {
            if (item._id === _id) {
              return response;
            }
            return item;
          });
          this.mode = null;
          this.toastr.success('Node successfully updated!');
        });
      return;
    }
    this.nodesRestService.create(restNode)
      .subscribe(response => {
        if (response) {
          if (this.nodes) {
            this.nodes.push(response);
          } else {
            this.nodes = [response];
          }
          this.mode = null;
          this.toastr.success('Node successfully created!');
        }
      });
  }

  onNodeDelete(id: string) {
    this.nodesRestService.removeById(id)
      .subscribe(() => {
        this.mode = null;
        this.selectedNode = null;
        this.selectedNodeId = null;
        this.nodes = this.nodes.filter(({ _id }) => _id !== id);
        this.toastr.success('Node successfully deleted');
      });
  }

  onNodeSelect(nodeId) {
    this.mode = 'EDIT';
    this.selectedNode = this.nodes.find(({ _id }) => _id === nodeId);
    this.selectedNodeId = nodeId;
  }

}
