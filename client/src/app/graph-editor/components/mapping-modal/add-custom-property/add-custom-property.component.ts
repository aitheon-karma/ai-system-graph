import { Component, Output, EventEmitter } from '@angular/core';
import { MappingDataType } from '../../../../shared/enums/mapping-data-type.enum';

@Component({
  selector: 'ai-add-custom-property',
  templateUrl: './add-custom-property.component.html',
  styleUrls: ['./add-custom-property.component.scss']
})
export class AddCustomPropertyComponent {
  @Output() typeSelected = new EventEmitter<MappingDataType>();

  public types: {
    key: string;
    label: string;
  }[] = [
    { key: MappingDataType.string, label: 'String' },
    { key: MappingDataType.integer, label: 'Number' },
    { key: MappingDataType.boolean, label: 'Boolean' },
    { key: MappingDataType.array, label: 'Array' },
    // { key: MappingDataType.object, label: 'Object' },
  ];
  public isOpened: boolean;

  onTypeSelect(type: MappingDataType): void {
    this.typeSelected.emit(type);
    this.close();
  }

  toggle(event: Event): void {
    this.stopEvent(event);
    this.isOpened = !this.isOpened;
  }

  close(): void {
    this.isOpened = false;
  }

  public stopEvent(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
  }
}
