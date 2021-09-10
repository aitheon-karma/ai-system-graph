import { NgModule } from '@angular/core';
import { GraphEditorModule } from '../graph-editor/graph-editor.module';
import { SharedModule } from '../shared/shared.module';

import { GraphComponent } from './graph/graph.component';
import { GraphsRoutingModule } from './graphs-routing.module';
import { SubgraphFormComponent } from './subgraph-form/subgraph-form.component';
import { GraphLoaderComponent } from './graph-loader/graph-loader.component';

@NgModule({
  declarations: [
    GraphComponent,
    SubgraphFormComponent,
    GraphLoaderComponent,
  ],
  imports: [
    SharedModule,
    GraphEditorModule,
    GraphsRoutingModule,
  ],
})
export class GraphsModule {}
