import {
  Bot,
  FunctionalNode,
  GraphsRestService,
  NodesRestService,
  SocketMetadata,
  SocketsRestService,
  Graph,
} from '@aitheon/system-graph';
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { NodeData, NodeSettings } from '../../../shared/models/node.model';
import { SharedService } from '../../../shared/services/shared.service';
import { NodesService } from '../../shared/services/nodes.service';
import { GraphType, ModalService, NodeType } from '@aitheon/core-client';

import { SocketsService } from '../../shared/services/sockets.service';

enum Tab {
  TICKS = 'TICKS',
  PARAMETERS = 'PARAMETERS',
  PROVISIONAL = 'PROVISIONAL',
  IO_SETTINGS = 'IO_SETTINGS',
}

@Component({
  selector: 'ai-node-settings',
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss'],
})
export class SettingsModalComponent implements OnInit, OnDestroy {
  @ViewChild('settingsModal') settingsModal: TemplateRef<any>;

  subscriptions$ = new Subscription();
  modalType = 'NODE_SETTINGS';
  tabTypes = Tab;
  tabs: {
    label: string,
    key: string,
  }[];
  activeTab: Tab;
  settingsModalRef: BsModalRef;
  paramsForm: FormGroup;
  ticksForm: FormGroup;
  nodeData: NodeData;
  nodeId: string;
  modalConfig = {
    ignoreBackdropClick: true,
    class: 'custom-modal',
  };
  dropdownClearable = false;
  submitted: boolean;
  templateForm: FormGroup;
  allowEditParameters: boolean;
  mandatoryItems: { label: string, value: boolean }[] = [
    { label: 'True', value: true },
    { label: 'False', value: false },
  ];
  loading: boolean;
  disabled: boolean;
  bots: Bot[];
  ioFormData: { inputs: SocketMetadata[], outputs: SocketMetadata[], isValid: boolean };
  formInputs: SocketMetadata[];
  formOutputs: SocketMetadata[];

  static intervalValidator(control: AbstractControl): null | {
    [key: string]: boolean,
  } {
    if (!control.parent || !control.parent.get('enabled').value) {
      return null;
    }
    const { value } = control;
    if (value !== '' && value <= 0) {
      return { invalid: true };
    }
    if (value === '' || Number(value) !== 0 && !value) {
      return { required: true };
    }
    if (Number(value) === 0 || !!Number(value)) {
      return null;
    } else {
      return { notNumber: true };
    }
  }

  constructor(
    private bsModalService: BsModalService,
    private modalService: ModalService,
    private sharedService: SharedService,
    private socketsService: SocketsService,
    private nodesService: NodesService,
    private socketsRestService: SocketsRestService,
    private graphsRestService: GraphsRestService,
    private nodesRestService: NodesRestService,
    private toastr: ToastrService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.subscriptions$.add(this.modalService.openModal$.subscribe(({ type, data }) => {
      if (type === this.modalType) {
        this.show(data);
      }
    }));
  }

  public show(modalData: { nodeId: string, data: NodeData }): void {
    this.clearData();
    this.nodeData = modalData.data;
    this.nodeId = modalData.nodeId;
    this.disabled = !!(this.isProvisionalNode && (this.nodeData.storeRequest && this.nodeData.storeRequest._id));
    this.createTabs();

    if (!this.isSubgraph && !this.isServiceNode) {
      this.initParamsForm();
      this.initTicksForm();
    }

    this.initTemplateSettings();

    this.setActiveTab();
    this.settingsModalRef = this.bsModalService.show(this.settingsModal, this.modalConfig);
  }

  createTabs() {
    this.tabs = Object.keys(Tab).map(tab => ({
      label: tab.split('_').join(' '),
      key: tab,
    }));
  }

  setActiveTab() {
    if (this.ticksForm) {
      this.activeTab = Tab.TICKS;
      return;
    }
    if (this.paramsForm) {
      this.activeTab = Tab.PARAMETERS;
      return;
    }
    this.activeTab = Tab.IO_SETTINGS;
  }

  initParamsForm(): void {
    const parameters = this.nodeData.settings.parameters || [];

    const parametersControls = (parameters || []).map(param => {
      const { _id, mandatory = false, value = null, name = null } = param;
      const isBot = name && name.includes('.BOT_USERNAME');
      const parameterControl = new FormGroup({
        isBot: new FormControl(isBot),
        _id: new FormControl(_id),
        mandatory: new FormControl(mandatory),
        name: new FormControl(name, Validators.required),
        value: new FormControl(value, Validators.required),
      });
      if (isBot) {
        this.nodesRestService.getAvailableBotsByParam(_id, name).subscribe((bots) => {
          this.bots = bots;
        });
      }
      return parameterControl;
    });

    this.paramsForm = new FormGroup({
      parameters: new FormArray(parametersControls),
    });
    if (this.disabled) {
      this.paramsForm.disable();
    }
  }

  initTicksForm(): void {
    const { ticks = [] } = this.settings;
    if (ticks.length) {
      this.ticksForm = this.fb.group({
        ticks: this.fb.array(ticks.map(tick => {
          const tickForm = this.fb.group({
            _id: [tick._id],
            name: [tick.name, Validators.required],
            interval: [tick.interval || 0, SettingsModalComponent.intervalValidator],
            enabled: [tick.enabled],
          });
          if (this.disabled) {
            tickForm.disable();
          }
          return tickForm;
        })),
      });
    }
  }

  switchTab(event: Event, tab: string): void {
    this.stopEvent(event);
    this.activeTab = tab as any;
  }

  getIO(io: { name: string, socket }[] = []): string[] {
    const sockets = [];
    for (const { socket } of io) {
      const socketObject = this.socketsService.getSocket(socket);
      if (!sockets.includes(socketObject.name)) {
        sockets.push(socketObject.name);
      }
    }
    return sockets;
  }

  onSaveSettings(event: Event): void {
    this.stopEvent(event);
    this.submitted = true;

    if (!this.formsValid || this.disabled) {
      return;
    }

    this.setPlacements();
    if (this.isSubgraph || this.isProvisionalNode) {
      const request = this.isSubgraph ? this.onSaveGraph.bind(this) : this.onSaveTemplate.bind(this);
      request().subscribe(() => {
        if (this.isSubgraph) {
          this.onGraphSaved();
        } else {
          this.saveSettings();
        }
      }, (error: Error) => {
        this.toastr.error(error.message || 'Unable to update template');
      });
      return;
    }

    this.saveSettings();
  }

  setPlacements(): void {
    const ioSettings = [...this.ioFormData.inputs, ...this.ioFormData.outputs]
      .map(({ placement, _id }, i) => ({
        io: _id,
        placement,
        order: i + 1
      }));
    if (!this.nodeData.graphNode) {
      this.nodeData.graphNode = {} as any;
    }
    this.nodeData.graphNode.ioSettings = ioSettings;
  }

  saveSettings() {
    if (this.paramsForm) {
      if (!this.paramsForm.valid) {
        return;
      }
      this.nodeData.settings.parameters = this.paramsForm.value?.parameters.map(param => {
        if (!param._id) {
          const { _id, ...paramToSave } = param;
          return paramToSave;
        }
        return param;
      });
    }

    if (this.ticksForm) {
      if (!this.ticksForm.valid) {
        return;
      }

      this.nodeData.settings.ticks = this.ticksForm.value.ticks;
    }

    this.modalService.onModalClose(this.modalType, {
      nodeId: this.nodeId,
      node: this.nodeData,
    });
    this.hide();
  }

  hide(event?: Event): void {
    if (event) {
      this.stopEvent(event);
    }
    this.settingsModalRef.hide();
  }

  getErrorMessage(control: AbstractControl): string {
    if ((control.get('value').touched || this.submitted) && !control.get('value').valid) {
      const requiredMessage = `${control.get('name').value || 'Property value'} is required`;
      if (control.get('name').value === 'tick') {
        if (control.get('enabled').value) {
          return control.get('value').hasError('notNumber') ? 'Tick must be a number' : requiredMessage;
        }
        return '';
      }
      return requiredMessage;
    }
    return '';
  }

  stopEvent(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  get settings(): NodeSettings {
    const { settings = {} } = this.nodeData;
    return settings as NodeSettings;
  }

  get paramsControlsArray(): FormArray {
    return this.paramsForm ? this.paramsForm.get('parameters') as FormArray : null;
  }

  get ticksControlsArray(): FormArray {
    return this.ticksForm ? this.ticksForm.get('ticks') as FormArray : null;
  }

  get formsValid(): boolean {
    if (this.paramsForm && !this.paramsForm.valid) {
      return false;
    }
    if (this.ticksForm && !this.ticksForm.valid) {
      return false;
    }
    if (this.templateForm && !this.templateForm.valid) {
      return false;
    }
    return !(this.ioFormData && !this.ioFormData.isValid);
  }

  private clearData(): void {
    this.paramsForm = null;
    this.ticksForm = null;
    this.templateForm = null;
    this.nodeData = null;
    this.submitted = false;
    this.activeTab = null;
    this.allowEditParameters = false;
  }

  /** TEMPLATE SETTINGS SECTION */
  initTemplateSettings() {
    this.formInputs = this.getFormIo('inputs');
    this.formOutputs = this.getFormIo('outputs');
    if (!this.isProvisionalNode) {
      this.activeTab = Tab.IO_SETTINGS;
    } else {
      this.allowEditParameters = true;
      this.initTemplateForm();
    }
    this.loading = false;
  }

  getFormIo(ioType: 'inputs' | 'outputs'): SocketMetadata[] {
    const ioSettings = this.nodeData.graphNode?.ioSettings;

    const formIo = this.nodeData[ioType]?.map(io => ({
      ...io,
      placement: this.nodeData.graphNode?.ioSettings?.find(settings => settings.io === io._id)?.placement || io.placement,
    })) || [];

    if (ioSettings) {
      const getIoSettingsById = id => ioSettings.find(i => i.io === id);
      return formIo.sort((previousIo, nextIo) => {
        const previousIoOrder = getIoSettingsById(previousIo._id)?.order;
        const nextIoOrder = getIoSettingsById(nextIo._id)?.order;
        return previousIoOrder - nextIoOrder;
      });
    }

    return formIo;
  }

  initTemplateForm() {
    const {
      description,
      name,
    } = this.nodeData;
    this.templateForm = this.fb.group({
      name: [name, Validators.required],
      description: [description],
    });
    if (this.disabled) {
      this.templateForm.disable();
    }
  }

  onSaveTemplate() {
    return this.nodesService.updateNode({
        type: this.nodeData.type,
        ...this.templateForm.value,
        inputs: this.clearIo(this.ioFormData.inputs),
        outputs: this.clearIo(this.ioFormData.outputs),
      },
      this.nodeData._id).pipe(tap((updatedNode: FunctionalNode) => {
      this.nodeData.name = updatedNode.name;
      this.nodeData.inputs = updatedNode.inputs;
      this.nodeData.outputs = updatedNode.outputs;
      this.nodeData.description = updatedNode.description;
      this.nodeData.templateVariables = updatedNode.templateVariables;
    }));
  }

  onSaveGraph() {
    return this.graphsRestService.getById(this.nodeData._id, true)
      .pipe(switchMap((graph: Graph) => {
        const updateObject = {
          ...graph,
          inputs: this.clearIo(this.ioFormData.inputs),
          outputs: this.clearIo(this.ioFormData.outputs),
        };
        return this.graphsRestService.update(graph._id, updateObject).pipe(tap((updatedGraph: Graph) => {
          this.nodeData.inputs = updatedGraph.inputs;
          this.nodeData.outputs = updatedGraph.outputs;
        }));
      }));
  }

  onIoFormChange(data: { inputs: SocketMetadata[], outputs: SocketMetadata[], isValid: boolean }): void {
    this.ioFormData = data;
  }

  onGraphSaved() {
    this.modalService.onModalClose(this.modalType, {
      nodeId: this.nodeId,
      node: this.nodeData,
    });
    this.hide();
  }

  addParameter(event: Event) {
    this.stopEvent(event);

    this.paramsControlsArray.push(this.fb.group({
      mandatory: new FormControl(true),
      name: new FormControl(null, Validators.required),
      value: new FormControl(null, Validators.required),
    }));
  }

  removeParameter(event: Event, index: number) {
    this.stopEvent(event);
    this.paramsControlsArray.removeAt(index);
  }

  clearIo(io: SocketMetadata[]): SocketMetadata[] {
    return io.map(({ placement, ...restIo }) => restIo);
  }

  get selectedTemplateTab() {
    if (this.activeTab === Tab.PROVISIONAL) {
      return Tab.PROVISIONAL;
    }
    if (this.activeTab === Tab.IO_SETTINGS) {
      return Tab.IO_SETTINGS;
    }

    return null;
  }

  /** END OF TEMPLATE SETTINGS SECTION */
  get isServiceNode(): boolean {
    return this.nodeData?.type === NodeType.SERVICE_NODE;
  }

  get isProvisionalNode(): boolean {
    return this.nodeData?.type === NodeType.TEMPLATE_NODE;
  }

  get isSubgraph(): boolean {
    return this.nodeData.type === GraphType.SUBGRAPH ||
      this.nodeData.type === GraphType.LINKED ||
      this.nodeData.type === GraphType.TEMPLATE ||
      this.nodeData.type === GraphType.SERVICE;
  }

  ngOnDestroy(): void {
    try {
      this.subscriptions$.unsubscribe();
    } catch {
    }
  }
}
