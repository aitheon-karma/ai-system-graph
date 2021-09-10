import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Subscription } from 'rxjs';
import { Component, OnInit, ViewChild, TemplateRef, HostListener, ElementRef } from '@angular/core';
import { ModalService } from '@aitheon/core-client';

@Component({
  selector: 'ai-file-viewer',
  templateUrl: './file-viewer.component.html',
  styleUrls: ['./file-viewer.component.scss']
})
export class FileViewerComponent implements OnInit {

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      this.onEditorTranslate(event);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.onEditorDrop();
  }

  @HostListener('document:dragend')
  onDocumentDragEnd(): void {
    this.onEditorDrop();
  }

  private subscriptions$ = new Subscription();

  @ViewChild('fileViewerModal') fileViewerModal: TemplateRef<any>;
  @ViewChild('editorContainer') editorContainer: ElementRef;

  modalType = 'FILE_VIEWER';
  fileViewerModalRef: BsModalRef;
  file: any;
  transformStyles: { [key: string]: string } = {
    transform: 'translate(0, 0) scale(1)',
  };
  transform: {
    scale: number,
    x: number,
    y: number,
  } = {
    scale: 1,
    x: 0,
    y: 0,
  };
  initTransform: {
    x: number,
    y: number,
  };
  dragStartCoordinates: {
    x: number,
    y: number,
  };
  size: {
    width: number,
    height: number,
  };
  restrictTranslation: boolean;
  isDragging: boolean;
  scale: number;

  constructor(private modalService: ModalService,
              private bsModalService: BsModalService) { }

  ngOnInit(): void {
    this.subscriptions$.add(
      this.modalService.openModal$.subscribe(({ type, data}) => {
        if (type === this.modalType) {
          this.show();
          this.file = data;
        }
      })
    )
  }

  onScroll(event: WheelEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.transform.scale < 0.4 && event.deltaY > 0 ||
      this.transform.scale >= 1.99 && event.deltaY < 0 ||
      this.restrictTranslation) {
      return;
    }

    if (event.deltaY < 0) {
      this.transform.scale += 0.05;
    } else {
      this.transform.scale -= 0.05;
    }

    this.calculateScale();
    this.setTransformStyles();
  }

  onEditorTranslate(event: MouseEvent): void {
    if (!this.dragStartCoordinates) {
      this.dragStartCoordinates = {
        x: event.clientX,
        y: event.clientY,
      };
      this.initTransform = {
        x: this.transform.x,
        y: this.transform.y,
      };
      return;
    }
    const deltaX = event.clientX - this.dragStartCoordinates.x;
    const deltaY = event.clientY - this.dragStartCoordinates.y;

    const translated = Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5;

    this.transform.x = this.initTransform.x + deltaX;
    this.transform.y = this.initTransform.y + deltaY;
    this.setTransformStyles();
  }

  zoomByButtons(e: Event, type: string) {
    e.stopPropagation();
    e.preventDefault();

    if (
      this.transform.scale < 0.4 && type === 'ZOOM_OUT' ||
      this.transform.scale > 2 && type === 'ZOOM_IN' ||
      this.restrictTranslation) {
      return;
    }

    if (type === 'ZOOM_IN') {
      this.transform.scale += 0.05;
    } else if (type === 'ZOOM_OUT') {
      this.transform.scale -= 0.05;
    }

    this.calculateScale();
    this.setTransformStyles();
  }

  fitMap() {
    this.transform = {
      ...this.transform,
      x: 0,
      y: 0
    };

    this.zoomToFit();
    this.setTransformStyles();
  }

  zoomToFit(): void {
    this.transform.scale = 1;
    this.transform.x = 0;
    this.transform.y = 0;
    this.calculateScale();
  }

  onEditorDrop(): void {
    this.isDragging = false;
    this.dragStartCoordinates = null;
    this.initTransform = null;
  }

  onEditorDrag() {
    this.isDragging = true;
  }

  calculateScale() {
    if (this.transform.scale > 2) {
      this.transform.scale = 2;
    }

    if (this.transform.scale < 0.4) {
      this.transform.scale = 0.4;
    }

    const scaleValue = Math.round(this.transform.scale / 0.05) * 0.05;
    this.scale = scaleValue * 100;
  }

  setTransformStyles(): void {
    this.transformStyles.transform = `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.scale})`;
  }

  public show() {
    this.fileViewerModalRef = this.bsModalService.show(
      this.fileViewerModal,
      Object.assign({}, { class: 'file-viewer-modal' })
    );
  }

  close() {
    this.fileViewerModalRef.hide();
    this.file = null;
    this.fitMap();
  }
}
