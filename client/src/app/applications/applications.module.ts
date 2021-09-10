import { CoreClientModule } from '@aitheon/core-client';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApplicationsRoutingModule } from './applications-routing.module';
import { ApplicationsDashboardComponent } from './applications-dashboard/applications-dashboard.component';

@NgModule({
  declarations: [
    ApplicationsDashboardComponent,
  ],
  imports: [
    CommonModule,
    CoreClientModule,
    ApplicationsRoutingModule,
  ],
  exports: []
})
export class ApplicationsModule { }
