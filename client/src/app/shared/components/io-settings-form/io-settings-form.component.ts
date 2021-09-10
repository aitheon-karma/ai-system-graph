import { Socket, SocketMetadata, SocketsRestService } from '@aitheon/system-graph';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ObjectId } from 'bson';
import { forkJoin, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SocketPlacement } from '../../enums/socket-placement.enum';

@Component({
  selector: 'ai-io-settings-form',
  templateUrl: './io-settings-form.component.html',
  styleUrls: ['./io-settings-form.component.scss']
})
export class IoSettingsFormComponent implements OnInit, OnDestroy {
  @Input() inputs: SocketMetadata[] = [];
  @Input() outputs: SocketMetadata[] = [];
  @Input() allowAddIo: boolean;
  @Input() submitted: boolean;
  @Output() formChange = new EventEmitter<{
    inputs: SocketMetadata[];
    outputs: SocketMetadata[];
    isValid: boolean;
  }>();

  ioForm: FormGroup;
  placements: { label: string, value: string }[];
  subscriptions$ = new Subscription();
  sockets: Socket[];
  groupedSockets: {
    _id: string,
    label: string,
    items: Socket[],
  }[] = [];

  constructor(
    private fb: FormBuilder,
    private socketsRestService: SocketsRestService,
  ) {}

  ngOnInit() {
    this.subscriptions$.add(this.getSockets().subscribe());
    this.setPlacements();
    this.ioForm = this.fb.group({
      inputs: this.fb.array(this.getIO(this.inputs, 'input')),
      outputs: this.fb.array(this.getIO(this.outputs, 'output')),
    });
    this.emitChange(this.ioForm.value);
    this.onFormChange();
  }

  private onFormChange(): void {
    this.subscriptions$.add(this.ioForm.valueChanges.subscribe(val => {
      this.emitChange(val);
    }));
  }

  emitChange(value: any): void {
    this.formChange.emit({
      ...value,
      isValid: this.ioForm.valid,
    });
  }

  setPlacements() {
    this.placements = Object.keys(SocketPlacement).map(placement => ({
      label: placement.substring(0, 1) + placement.substring(1).toLowerCase(),
      value: placement,
    }));
  }

  public getFormValue() {
    return this.ioForm ? this.ioForm.value : null;
  }

  getIO(io: SocketMetadata[], type: 'input' | 'output') {
    return io.map(({
                     name,
                     multiple,
                     socket,
                     placement,
                     _id,
                   }) => {
      const ioSettings = this.fb.group({
        _id: [_id],
        placement: [placement ? placement : (type === 'input' ? SocketPlacement.LEFT : SocketPlacement.RIGHT)],
        name: [name, Validators.required],
        multiple: [multiple === false ? false : multiple || type !== 'input'],
        socket: [socket, Validators.required],
      });
      this.disableIoIfNotAllowed(ioSettings);
      return ioSettings;
    });
  }

  disableIoIfNotAllowed(ioGroup: FormGroup): void {
    if (!this.allowAddIo) {
      ioGroup.get('name').disable();
      ioGroup.get('multiple').disable();
      ioGroup.get('socket').disable();
    }
  }

  getSockets() {
    return forkJoin([
      this.socketsRestService.listGroups(),
      this.socketsRestService.list(),
    ]).pipe(tap(([groups, sockets]) => {
      this.sockets = sockets;
      for (const group of groups) {
        this.groupedSockets.push({
          _id: group._id,
          label: group.name,
          items: this.sockets
            .filter(({ group: socketGroup }) => socketGroup === group._id as any),
        });
      }
      this.groupedSockets = [...this.groupedSockets];
    }));
  }

  ioDraggingEnded(event: CdkDragDrop<FormArray>, type: 'input' | 'output') {
    const { currentIndex, previousIndex, item } = event;
    if (type === 'input') {
      this.inputsArray.removeAt(previousIndex);
      this.inputsArray.insert(currentIndex, item.data);
    }
    if (type === 'output') {
      this.outputsArray.removeAt(previousIndex);
      this.outputsArray.insert(currentIndex, item.data);
    }
  }

  addIO(event: Event, type: string) {
    this.stopEvent(event);

    const ioControl = this.fb.group({
      _id: [new ObjectId().toString()],
      placement: [type === 'input' ? SocketPlacement.LEFT : SocketPlacement.RIGHT],
      name: [null, Validators.required],
      multiple: [!(type === 'input')],
      socket: [null, Validators.required],
    });
    if (type === 'input') {
      this.inputsArray.push(ioControl);
    }
    if (type === 'output') {
      this.outputsArray.push(ioControl);
    }
  }

  deleteIO(event: Event, index: number, io: string) {
    this.stopEvent(event);

    if (io === 'input') {
      this.inputsArray.removeAt(index);
    }
    if (io === 'output') {
      this.outputsArray.removeAt(index);
    }
  }

  stopEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  get inputsArray() {
    return this.ioForm.get('inputs') as FormArray;
  }

  get outputsArray() {
    return this.ioForm.get('outputs') as FormArray;
  }

  ngOnDestroy() {
    this.subscriptions$.unsubscribe();
  }
}
