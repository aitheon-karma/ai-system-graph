import { FunctionalNode, Socket, SocketGroup, SocketMetadata, SocketsRestService, } from '@aitheon/system-graph';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators, } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { CustomValidators } from '../../shared/validators';
import { NODE_TEMPLATE } from './node-template';

@Component({
  selector: 'ai-node-details',
  templateUrl: './node-details.component.html',
  styleUrls: ['./node-details.component.scss']
})
export class NodeDetailsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() mode: string;
  @Input() node: any;
  @Input() group: any;
  @Output() delete = new EventEmitter<string>();
  @Output() save = new EventEmitter<{
    name: string,
    description: string,
    structure: string,
    group?: string,
    _id?: string,
  }>();

  groupRuntimes: {
    [key: string]: string[],
  };
  sockets: Socket[] = [];
  validSockets: Socket[] = [];
  nodeForm: FormGroup;
  submitted = false;
  runtimes: { label: string, value: string }[] = [
    { label: 'AOS', value: 'AOS' },
    { label: 'AOS Embedded', value: 'AOS_EMBEDDED' },
    { label: 'AOS Cloud', value: 'AOS_CLOUD' },
  ];
  dropdownItems: any[] = [];
  dropdownClearable = false;
  inputsSubscription: Subscription;
  outputsSubscription: Subscription;

  constructor(
    private fb: FormBuilder,
    private socketsRestService: SocketsRestService,
  ) {}

  ngOnInit(): void {
    forkJoin([
      this.socketsRestService.listGroups(),
      this.socketsRestService.list()
    ]).subscribe(([socketGroups, sockets]: [SocketGroup[], Socket[]]) => {
      const groupRuntimes: {
        [key: string]: string[],
      } = {};
      for (const group of socketGroups) {
        groupRuntimes[group._id] = group.runtimes;
      }
      this.groupRuntimes = groupRuntimes;
      this.sockets = this.validSockets = sockets;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const { mode, node } = changes;

    if (mode && mode.currentValue === 'EDIT' || node && node.currentValue) {
      this.initNodeForm(this.node);
      return;
    }
    if (mode && mode.currentValue === 'ADD') {
      this.initNodeForm();
      return;
    }
    this.nodeForm = null;
    this.submitted = false;
  }

  getRuntimes() {
    this.dropdownItems = this.runtimes.filter(runtime => this.group.runtimes.includes(runtime.value));
  }

  initNodeForm(node?: any) {
    this.getRuntimes();
    const {
      type = NODE_TEMPLATE.type,
      templateVariables = NODE_TEMPLATE.templateVariables,
      runtimeParameters = NODE_TEMPLATE.runtimeParameters,
      name = null,
      description = null,
      inputs = [],
      outputs = [],
      runtime = null,
    } = node || {};
    const {
      training = {},
      inference = {},
      settings = {},
    } = templateVariables;
    if (node) {
      delete training._id;
      delete settings._id;
      delete runtimeParameters._id;
      delete inference._id;
    }

    const clearedParameters = {};
    for (const parameter of Object.keys(settings.parameters)) {
      const { _id, ...restParameter } = settings.parameters[parameter];
      clearedParameters[parameter] = restParameter;
    }

    const structure = {
      type,
      runtimeParameters,
      templateVariables: {
        inference,
        training,
        settings: {
          ...settings,
          parameters: clearedParameters,
        },
      },
    };

    this.nodeForm = this.fb.group({
      name: [name, Validators.required],
      description: [description],
      runtime: [runtime, Validators.required],
      group: [this.group.name, Validators.required],
      inputs: this.fb.array(this.getIO(inputs, 'input')),
      outputs: this.fb.array(this.getIO(outputs, 'output')),
      structure: [
        JSON.stringify(structure, null, '\t'),
        [Validators.required, CustomValidators.json],
      ],
    });
    this.nodeForm.get('group').disable();
    this.subscribeToRuntimeChanges();
  }

  subscribeToRuntimeChanges() {
    if (this.runtime.value === 'AOS') {
      this.nodeForm.addControl('deviceType', new FormControl(null));
    }
    if (this.runtime.value) {
      this.filterSockets(this.runtime.value);
    }
    this.runtime.valueChanges
      .subscribe(value => {
        this.filterSockets(value);
        if (value === 'AOS') {
          this.nodeForm.addControl('deviceType', new FormControl(null));
          return;
        }
        this.nodeForm.removeControl('deviceType');
      });
  }

  filterSockets(runtime: string) {
    this.validSockets = this.sockets.filter(socket => {
      if (!this.runtime.value) {
        return false;
      }
      const groupRuntimes = this.groupRuntimes[socket.group as any];
      return groupRuntimes && groupRuntimes.includes(runtime);
    });
  }

  onDelete(event: Event) {
    this.preventEvent(event);

    const { _id } = this.node;
    if (_id) {
      this.delete.emit(_id);
    }
  }

  onSave(event: Event) {
    this.preventEvent(event);

    if (!this.nodeForm.valid) {
      this.submitted = true;
      return;
    }

    const node = this.node || {};
    const { _id = null } = node;
    const { structure, ...restValue } = this.nodeForm.value;
    const {
      type,
      templateVariables,
      runtimeParameters,
    } = JSON.parse(structure) as FunctionalNode;
    this.save.emit({
      ...restValue,
      type,
      runtimeParameters,
      templateVariables,
      _id: this.mode === 'EDIT' ? _id : null,
      group: this.group._id,
    });
  }

  addIO(event: Event, type: string) {
    this.preventEvent(event);

    const io = this.fb.group({
      name: [null, Validators.required],
      multiple: [!(type === 'input')],
      socket: [null, Validators.required],
    });
    if (type === 'input') {
      this.inputsArray.push(io);
    }
    if (type === 'output') {
      this.outputsArray.push(io);
    }
  }

  deleteIO(event: Event, index: number, io: string) {
    this.preventEvent(event);

    if (io === 'input') {
      this.inputsArray.removeAt(index);
    }
    if (io === 'output') {
      this.outputsArray.removeAt(index);
    }
  }

  getIO(io: SocketMetadata[], type: string) {
    return io.map(({ name, multiple, socket, _id }) => this.fb.group({
      _id: [_id],
      name: [name, Validators.required],
      multiple: [multiple === false ? false : multiple || (type !== 'input')],
      socket: [socket, [Validators.required, this.validateSocket.bind(this)]],
    }));
  }

  validateSocket(control: AbstractControl): { [key: string]: boolean } | null {
    const { value } = control;
    const runtime = this.runtime && this.runtime.value;
    const socket = this.sockets.find(s => s._id === value);
    if (socket && runtime) {
      const groupRuntimes = this.groupRuntimes[socket.group as any];
      if (groupRuntimes && groupRuntimes.includes(runtime)) {
        return null;
      }
      return {
        invalidRuntime: true,
      };
    }
    return null;
  }

  preventEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  get runtime() {
    return this.nodeForm && this.nodeForm.get('runtime') as FormControl;
  }

  get deviceType() {
    if (this.nodeForm.get('deviceType')) {
      return this.nodeForm.get('deviceType') as FormControl;
    }
    return null;
  }

  get inputsArray() {
    return this.nodeForm.get('inputs') as FormArray;
  }

  get outputsArray() {
    return this.nodeForm.get('outputs') as FormArray;
  }

  get structure() {
    return this.nodeForm.get('structure') as FormControl;
  }

  ngOnDestroy(): void {
    if (this.inputsSubscription) {
      try {
        this.inputsSubscription.unsubscribe();
      } catch {}
    }
    if (this.outputsSubscription) {
      try {
        this.outputsSubscription.unsubscribe();
      } catch {}
    }
  }
}
