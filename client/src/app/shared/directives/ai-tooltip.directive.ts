import { SafeHTMLPipe } from '../pipes/safe-html.pipe';
import { Directive, Input, ElementRef, HostListener, Renderer2 } from '@angular/core';
import { SharedService } from '../services/shared.service';

@Directive({
  selector: '[aiTooltip]',
  providers: [SafeHTMLPipe]
})
export class AiTooltipDirective {
  @Input('aiTooltip') tooltipTitle: string;
  @Input() placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() delay: string | number = 1;
  @Input() offset: string | number = 10;
  @Input() hideOnClick = false;
  tooltip: HTMLElement;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private safeHTML: SafeHTMLPipe,
    private sharedService: SharedService,
  ) {}

  @HostListener('mouseenter') onMouseEnter() {
    this.show();
  }

  @HostListener('mousedown') onMouseDown() {
    this.hide();
  }

  @HostListener('mouseleave') onMouseLeave() {
    if (this.tooltip) {
      this.hide();
    }
  }

  show() {
    if (!this.tooltip) {
      this.create();
    }
    this.setPosition();
    this.renderer.addClass(this.tooltip, 'ng-tooltip-show');
  }

  hide() {
    if (!this.tooltip) {
      return;
    }
    this.renderer.removeClass(this.tooltip, 'ng-tooltip-show');
    this.sharedService.delay(Number(this.delay)).subscribe(() => {
        this.renderer.removeChild(document.body, this.tooltip);
        this.tooltip = null;
    });
  }

  create() {
    this.tooltip = this.renderer.createElement('span');
    this.tooltip.innerHTML = this.safeHTML.transform(this.tooltipTitle);

    this.renderer.appendChild(document.body, this.tooltip);

    this.renderer.addClass(this.tooltip, 'ng-tooltip');
    this.tooltip.innerHTML = this.tooltipTitle;
    this.renderer.addClass(this.tooltip, `ng-tooltip-${this.placement}`);

    this.renderer.setStyle(this.tooltip, '-webkit-transition', `opacity ease-in-out ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, '-moz-transition', `opacity ease-in-out ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, '-o-transition', `opacity ease-in-out ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, 'transition', `opacity ease-in-out ${this.delay}ms`);

    if (!this.tooltipTitle.length) {
      this.renderer.addClass(this.tooltip, 'd-none');
    }
  }

  setPosition() {
    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltip.getBoundingClientRect();
    const scrollPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    let top, left;

    switch (this.placement) {
      case 'top':
        top = hostPos.top - tooltipPos.height - Number(this.offset);
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'bottom':
        top = hostPos.bottom + Number(this.offset);
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'left':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.left - tooltipPos.width - Number(this.offset);
        break;
      case 'right':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.right + Number(this.offset);
        break;
      default:
        this.hide();
    }

    this.renderer.setStyle(this.tooltip, 'top', `${top + scrollPos}px`);
    this.renderer.setStyle(this.tooltip, 'left', `${left}px`);
  }
}
