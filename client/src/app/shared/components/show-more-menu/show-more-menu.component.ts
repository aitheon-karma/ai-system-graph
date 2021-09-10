import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'ai-show-more-menu',
  templateUrl: './show-more-menu.component.html',
  styleUrls: ['./show-more-menu.component.scss']
})
export class ShowMoreMenuComponent {
  @Input() items: {
    label: string;
    key: string;
  }[];
  @Input() small: boolean;
  @Output() itemSelected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  private _isOpened: boolean;

  public get isOpened(): boolean {
    return this._isOpened;
  }

  public set isOpened(value: boolean) {
    this._isOpened = value;
  }

  public open(): void {
    this.isOpened = true;
  }

  public toggle(): void {
    this.isOpened = !this.isOpened;
  }

  public close(): void {
    this.isOpened = false;
    this.closed.emit();
  }

  public onItemSelect(itemKey: string, event: Event): void {
    this.stopEvent(event);
    this.itemSelected.emit(itemKey);
    this.close();
  }

  stopEvent(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
  }
}
