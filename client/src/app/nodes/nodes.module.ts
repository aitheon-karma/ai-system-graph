import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { NodesDashboardComponent } from './nodes-dashboard/nodes-dashboard.component';

import { CoreNodesRoutingModule } from './nodes-routing.module';
import { GroupModalComponent } from './group-modal/group-modal.component';
import { ListComponent } from './list/list.component';
import { NodeDetailsComponent } from './node-details/node-details.component';

@NgModule({
  declarations: [
    NodesDashboardComponent,
    ListComponent,
    NodeDetailsComponent,
    GroupModalComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    CoreNodesRoutingModule
  ]
})
export class CoreNodesModule { }
