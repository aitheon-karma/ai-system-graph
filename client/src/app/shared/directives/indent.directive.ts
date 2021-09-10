import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[indent]',
})
export class IndentDirective {
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      document.execCommand('insertText', false, '    ');
    }
  }
}
