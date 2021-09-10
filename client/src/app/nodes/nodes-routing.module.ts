import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { isAdminGuard } from '../shared/guards/isAdmin.guard';

import { NodesDashboardComponent } from './nodes-dashboard/nodes-dashboard.component';

const routes: Routes = [
  { path: '', component: NodesDashboardComponent, canActivate: [isAdminGuard] },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CoreNodesRoutingModule {}
