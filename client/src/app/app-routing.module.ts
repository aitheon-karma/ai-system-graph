import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/graphs/organization', pathMatch: 'full' },
  {
    path: 'graphs',
    loadChildren: () => import('./graphs/graphs.module').then(m => m.GraphsModule) },
  {
    path: 'service-items',
    loadChildren: () => import('./service-items/service-items.module').then(m => m.ServiceItemsModule) },
  {
    path: 'admin/sockets',
    loadChildren: () => import('./sockets/sockets.module').then(m => m.SocketsModule) },
  {
    path: 'admin/nodes',
    loadChildren: () => import('./nodes/nodes.module').then(m => m.CoreNodesModule) },
  {
    path: 'applications/:projectId/:graphNodeId',
    loadChildren: () => import('./applications/applications.module').then(m => m.ApplicationsModule),
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: []
})
export class AppRoutingModule {}
