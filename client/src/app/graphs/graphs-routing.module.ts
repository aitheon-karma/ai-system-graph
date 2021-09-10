import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GraphComponent } from './graph/graph.component';
import { isAdminGuard } from '../shared/guards/isAdmin.guard';
import { Accesses } from '../shared/accesses';

const routes: Routes = [
  { path: 'create', component: GraphComponent },
  { path: 'update/:subGraphTemplateId', component: GraphComponent },
  { path: 'organization', component: GraphComponent },
  { path: 'organization/sub-graph/:subGraphId', component: GraphComponent },
  { path: 'organization/service/:serviceId', component: GraphComponent },
  { path: 'organization/service/:serviceId/sub-graph/:subGraphId', component: GraphComponent },
  { path: 'core', component: GraphComponent, canActivate: [isAdminGuard], data: { role: Accesses.CORE_GRAPH_ACCESS } },
  { path: 'core/sub-graph/:subGraphId', component: GraphComponent, canActivate: [isAdminGuard], data: { role: Accesses.CORE_GRAPH_ACCESS } },
  { path: 'core/service/:serviceId', component: GraphComponent, canActivate: [isAdminGuard], data: { role: Accesses.CORE_GRAPH_ACCESS } },
  { path: 'core/service/:serviceId/sub-graph/:subGraphId', component: GraphComponent, canActivate: [isAdminGuard], data: { role: Accesses.CORE_GRAPH_ACCESS } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GraphsRoutingModule { }
