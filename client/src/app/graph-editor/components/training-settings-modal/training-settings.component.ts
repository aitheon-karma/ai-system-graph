import { Component, TemplateRef, ViewChild, } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { CustomValidators } from '../../../shared/validators';
import { NodeType } from '@aitheon/core-client';

@Component({
  selector: 'ai-training-settings-modal',
  templateUrl: './training-settings.component.html',
  styleUrls: ['./training-settings.component.scss'],
})
export class TrainingSettingsModalComponent {
  @ViewChild('addNodeModal') trainingSettingsModal: TemplateRef<any>;
  trainingSettingsModalRef: BsModalRef;

  data: any;
  disabled: boolean;
  trainingForm: FormGroup;
  dropdownItems = [
    { name: 'Owner', value: 'owner' },
    { name: 'Admin', value: 'admin' },
    { name: 'User', value: 'user' },
    { name: 'Specialist', value: 'specialist' },
  ];

  constructor(private modalService: BsModalService) {
  }

  public show(data: any) {
    this.data = data;
    this.disabled = !!(data.type === NodeType.TEMPLATE_NODE && (data.storeRequest && data.storeRequest._id));
    this.trainingSettingsModalRef = this.modalService.show(this.trainingSettingsModal, {
      ignoreBackdropClick: true,
    });
    this.initForm();
  }

  initForm() {
    this.trainingForm = new FormGroup({
      enabled: new FormControl(this.trainingData.enabled),
      permissions: new FormControl(this.initPermissionsControl(), Validators.required),
      interval: new FormControl(
        this.trainingData.interval,
        [Validators.required, CustomValidators.number, Validators.min(0)],
      ),
      consensusConfirmations: new FormControl(
        this.trainingData.consensusConfirmations,
        [Validators.required, CustomValidators.number, Validators.min(0)],
      ),
    });

    if (this.disabled) {
      this.trainingForm.disable();
    } else {
      this.enabledControl.valueChanges.subscribe(enabled => {
        if (enabled) {
          this.consensusConfirmationsControl.enable();
          this.intervalControl.enable();
          this.permissionsControl.enable();
          return;
        }
        this.consensusConfirmationsControl.disable();
        this.intervalControl.disable();
        this.permissionsControl.disable();
      });
    }
  }

  initPermissionsControl() {
    if (this.trainingData.permissions) {
      return Object.keys(this.trainingData.permissions)
        .filter(role => this.trainingData.permissions[role]);
    }
    return [];
  }

  onSaveTrainingSettings(event: Event) {
    this.stopEvent(event);
    const { interval, enabled, consensusConfirmations } = this.trainingForm.value;
    const trainingSettings = {
      ...this.trainingData,
      enabled,
      interval: Number(interval),
      consensusConfirmations: Number(consensusConfirmations),
      permissions: this.getUpdatedPermissionsObject(),
    };
    this.data.callback(trainingSettings);
    this.hide();
  }

  getUpdatedPermissionsObject() {
    const permissions = {
      user: false,
      superAdmin: false,
      admin: false,
    };
    for (const role of this.permissionsControl.value) {
      permissions[role] = true;
    }
    return permissions;
  }

  hide() {
    this.trainingSettingsModalRef.hide();
    this.data = null;
    this.trainingForm = null;
  }

  stopEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }

  get trainingData() {
    if (this.data && this.data.training) {
      return this.data.training;
    }
    return {};
  }

  get enabledControl() {
    return this.trainingForm.get('enabled') as FormControl;
  }

  get intervalControl() {
    return this.trainingForm.get('interval') as FormControl;
  }

  get permissionsControl() {
    return this.trainingForm.get('permissions') as FormControl;
  }

  get consensusConfirmationsControl() {
    return this.trainingForm.get('consensusConfirmations') as FormControl;
  }
}
