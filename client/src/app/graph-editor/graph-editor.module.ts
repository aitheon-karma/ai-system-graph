import { MainModule } from '@aitheon/lib-graph-render-plugin';
import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { GraphLogsComponent } from './components/graph-logs/graph-logs.component';
import { ImageNodeComponent } from './components/image-node/image-node.component';
import { MappingNodeComponent } from './components/mapping-node/mapping-node.component';
import { NodeComponent } from './components/node/node.component';
import { ReleasesModalComponent } from './components/releases-modal/releases-modal.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { ToolboxComponent } from './components/toolbox/toolbox.component';
import { TrainingSettingsModalComponent } from './components/training-settings-modal/training-settings.component';
import { GraphEditorComponent } from './graph-editor.component';
import { InformationNodeComponent } from './components/information-node/information-node.component';
import { StoreRequestModalComponent } from './components/store-request-modal/store-request-modal.component';
import { ColorPickerModule } from 'ngx-color-picker';
import { NodePreviewComponent } from './components/node-preview/node-preview.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MappingModalComponent } from './components/mapping-modal/mapping-modal.component';
import { IoSelectorComponent } from './components/mapping-modal/io-selector/io-selector.component';
import { IoPropertyComponent } from './components/mapping-modal/io-property/io-property.component';
import { AddCustomPropertyComponent } from './components/mapping-modal/add-custom-property/add-custom-property.component';
import { SocketViewComponent } from './components/socket-view/socket-view.component';

@NgModule({
  declarations: [
    NodeComponent,
    MappingNodeComponent,
    ToolboxComponent,
    GraphLogsComponent,
    GraphEditorComponent,
    ReleasesModalComponent,
    SettingsModalComponent,
    TrainingSettingsModalComponent,
    InformationNodeComponent,
    StoreRequestModalComponent,
    NodePreviewComponent,
    MappingModalComponent,
    IoSelectorComponent,
    IoPropertyComponent,
    AddCustomPropertyComponent,
    ImageNodeComponent,
    SocketViewComponent,
  ],
  imports: [
    DragDropModule,
    SharedModule,
    MainModule,
    ColorPickerModule
  ],
  exports: [
    GraphEditorComponent,
  ],
  entryComponents: [
    NodeComponent,
    MappingNodeComponent,
    ImageNodeComponent,
  ],
})
export class GraphEditorModule {}
