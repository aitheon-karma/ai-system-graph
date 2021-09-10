import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { CoreClientModule } from '@aitheon/core-client';
import { ServiceItemsRoutingModule } from './service-items-routing.module';
import { ServiceItemsComponent } from './service-items.component';

@NgModule({
  declarations: [
    ServiceItemsComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    ServiceItemsRoutingModule,
    CoreClientModule
  ],
})
export class ServiceItemsModule { }
