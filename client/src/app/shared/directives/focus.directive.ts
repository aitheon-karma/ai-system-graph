import { Directive, ElementRef, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[aiFocus]'
})
export class FocusDirective implements AfterViewInit {
  constructor(
    private elementRef: ElementRef<HTMLInputElement>,
  ) {}

  ngAfterViewInit(): void {
    const timeout = setTimeout(() => {
      this.elementRef.nativeElement.focus();
      clearTimeout(timeout);
    });
  }
}
