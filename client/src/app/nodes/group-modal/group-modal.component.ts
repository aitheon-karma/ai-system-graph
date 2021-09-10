import { Component, EventEmitter, Output, ViewChild, } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService, ModalDirective } from 'ngx-bootstrap/modal';

@Component({
  selector: 'ai-group-modal',
  templateUrl: './group-modal.component.html',
  styleUrls: ['./group-modal.component.scss']
})
export class GroupModalComponent {
  @ViewChild('modal') modal: ModalDirective;

  @Output() removeGroup = new EventEmitter<string>();
  @Output() submit = new EventEmitter<{
    _id?: string,
    name: string,
    runtime: string[],
    description: string,
  }>();

  group: any;
  submitted = false;
  dropdownItems: { label: string, value: string }[] = [
    { label: 'AOS', value: 'AOS' },
    { label: 'AOS Embedded', value: 'AOS_EMBEDDED' },
    { label: 'AOS Cloud', value: 'AOS_CLOUD' },
  ];
  groupForm: FormGroup;
  modalRef: BsModalRef;

  constructor(
    private modalService: BsModalService,
  ) {}

  public show(group?) {
    if (group) {
      this.group = group;
    }
    this.initGroupForm();
    this.modalRef = this.modalService.show(this.modal);
  }

  initGroupForm() {
    const {
      name = null,
      runtimes = null,
      description = null,
    } = this.group || {};

    this.groupForm = new FormGroup({
      name: new FormControl(name, Validators.required),
      runtimes: new FormControl(runtimes, Validators.required),
      description: new FormControl(description),
    });
  }

  onSave(event: Event) {
    this.preventEvent(event);

    this.submitted = true;
    if (!this.groupForm.valid) {
      return;
    }

    const _id = this.group ? this.group._id : null;
    this.submit.emit({
      _id,
      ...this.groupForm.value
    });

    this.close();
  }

  onRemoveGroup(event: Event) {
    this.preventEvent(event);

    if (this.group && this.group._id) {
      this.removeGroup.emit(this.group._id);
      this.close();
    }
  }

  close(event?: Event) {
    if (event) {
      this.preventEvent(event);
    }

    this.modalRef.hide();
    this.group = null;
    this.submitted = false;
  }

  preventEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }
}
