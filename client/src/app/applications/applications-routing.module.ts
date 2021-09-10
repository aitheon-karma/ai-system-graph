import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ApplicationsDashboardComponent } from './applications-dashboard/applications-dashboard.component';


const routes: Routes = [
  { component: ApplicationsDashboardComponent, path: '' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ApplicationsRoutingModule {}
