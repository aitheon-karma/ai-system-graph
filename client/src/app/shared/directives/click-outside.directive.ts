import { Directive, ElementRef, OnInit, Output, HostListener, EventEmitter } from '@angular/core';

@Directive({
  selector: '[aiClickOutside]'
})
export class ClickOutsideDirective implements OnInit {
  @Output() clickedOutside = new EventEmitter<Event>();

  uniqueClass = `${Number(new Date) * Math.random()}`.replace('.', '-');
  constructor(
    private el: ElementRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onClick(event: Event) {
    if (!this.isParentClicked((<any>event).path)) {
      this.clickedOutside.emit(event);
    }
  }

  ngOnInit(): void {
    this.el.nativeElement.classList.add(this.uniqueClass);
  }

  isParentClicked(path: HTMLElement[]): boolean {
    return !!path.find(el => el.classList && el.classList.contains(this.uniqueClass));
  }
}
