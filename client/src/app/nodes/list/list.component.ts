import { Component, EventEmitter, Input, Output, } from '@angular/core';

@Component({
  selector: 'ai-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ListComponent {
  @Input() label: string;
  @Input() items: any[];
  @Input() selectedId: string;

  @Output() add = new EventEmitter<void>();
  @Output() select = new EventEmitter<string>();
  @Output() edit = new EventEmitter<any>();

  onAdd(event) {
    this.preventEvent(event);

    this.add.emit();
  }

  onSelect(event: Event, { _id }: any = {}) {
    this.preventEvent(event);

    if (_id) {
      this.select.emit(_id);
    }
  }

  onEdit(event: Event, item) {
    this.preventEvent(event);

    if (item) {
      this.edit.emit(item);
    }
  }

  preventEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }
}
