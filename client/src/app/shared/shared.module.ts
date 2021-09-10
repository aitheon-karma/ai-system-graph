import { CoreClientModule } from '@aitheon/core-client';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ModalModule } from 'ngx-bootstrap/modal';
import { PaginationComponent } from './components/pagination/pagination.component';
import { TableComponent } from './components/table/table.component';
import { ClickOutsideDirective } from './directives/click-outside.directive';
import { DisableControlDirective } from './directives/disable-control.directive';
import { FocusDirective } from './directives/focus.directive';
import { IndentDirective } from './directives/indent.directive';
import { isAdminGuard } from './guards/isAdmin.guard';
import { FileExtensionPipe } from './pipes/file-extension.pipe';
import { FillRowsPipe } from './pipes/fill-rows.pipe';
import { AiTooltipDirective } from './directives/ai-tooltip.directive';
import { IoSettingsFormComponent } from './components/io-settings-form/io-settings-form.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { PrettyEnumPipe } from './pipes/pretty-enum.pipe';
import { SafeHTMLPipe } from './pipes/safe-html.pipe';
import { ShowMoreMenuComponent } from './components/show-more-menu/show-more-menu.component';
import { StringifyArrayPipe } from './pipes/stringify-array.pipe';
import { FileViewerComponent } from './components/file-viewer/file-viewer.component';

@NgModule({
  declarations: [
    FocusDirective,
    TableComponent,
    PaginationComponent,
    FillRowsPipe,
    FileExtensionPipe,
    StringifyArrayPipe,
    IndentDirective,
    AiTooltipDirective,
    DisableControlDirective,
    ClickOutsideDirective,
    IoSettingsFormComponent,
    SafeHTMLPipe,
    PrettyEnumPipe,
    ShowMoreMenuComponent,
    FileViewerComponent,
  ],
  imports: [
    CoreClientModule,
    DragDropModule,
    ReactiveFormsModule,
    ModalModule,
    CommonModule,
    NgSelectModule,
  ],
  providers: [
    isAdminGuard
  ],
  exports: [
    FocusDirective,
    CoreClientModule,
    CommonModule,
    TableComponent,
    ReactiveFormsModule,
    NgSelectModule,
    FileExtensionPipe,
    StringifyArrayPipe,
    IndentDirective,
    AiTooltipDirective,
    DisableControlDirective,
    ClickOutsideDirective,
    SafeHTMLPipe,
    PrettyEnumPipe,
    ShowMoreMenuComponent,
    IoSettingsFormComponent,
    FileViewerComponent,
  ],
})
export class SharedModule {}
