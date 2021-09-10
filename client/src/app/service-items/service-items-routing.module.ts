import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ServiceItemsComponent } from './service-items.component';

const routes: Routes = [
  { path: ':serviceId', component: ServiceItemsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ServiceItemsRoutingModule { }
