import { Coordinates } from '@aitheon/core-client';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { Observable, Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { IoType } from '../../../../shared/enums/io-type.enum';
import { MappingDataType } from '../../../../shared/enums/mapping-data-type.enum';
import { MappingProperty } from '../../../../shared/interfaces/mapping-property.interface';
import { isValidType } from '../../../../shared/utils/is-valid-type';
import { MappingConnection, MappingService } from '../../../shared/services/mapping-service';



@Component({
  selector: 'ai-io-property',
  templateUrl: './io-property.component.html',
  styleUrls: ['./io-property.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IoPropertyComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('connectionEdge') connectionEdge: ElementRef;
  @ViewChild('propertyContent') propertyContent: ElementRef;

  @Input() property: MappingProperty;
  @Input() isLast: boolean;
  @Input() ioType: IoType;
  @Input() parentReference: HTMLElement;
  @Output() removeProperty = new EventEmitter<MappingProperty>();

  public submitted$: Observable<boolean>;
  public connections: MappingConnection[] = [];
  public propertyTypes = MappingDataType;
  public propertyItems: {
    label: string;
    value: string | boolean;
  }[] = [];
  subscriptions$ = new Subscription();
  propertyForm: FormGroup;
  valueTypeForm: FormGroup;
  connectionStyle: {
    height: string;
  };
  ioTypes = IoType;
  isPicked: boolean;
  isCompatible: boolean;
  isSelected: boolean;
  isConnectionError: boolean;
  hasConnection: boolean;
  propertyContentObserver: MutationObserver;
  public dotHovered: boolean;

  constructor(
    private mappingService: MappingService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef,
  ) {}

  ngOnInit(): void {
    this.submitted$ = this.mappingService.submitted$;

    if (this.property.isCustom || this.property.valueType) {
      this.initPropertyForm();
    }
    if (this.property.valueType) {
      this.initValueTypeForm();
    }
    if (this.property.type === MappingDataType.boolean || this.property.enum) {
      this.createPropertyValueItems();
    }

    this.createParentConnection();

    this.onSectionUIUpdate();
    this.onConnectionPick();
    this.onConnectionDrop();
    this.onConnectionCreated();
    this.onConnectionRemoved();
  }

  ngAfterViewInit(): void {
    this.property.el = this.connectionEdge.nativeElement;
    this.propertyContentObserver = new MutationObserver(() => {
      this.mappingService.updateSectionUI(this.ioType);
    });
    this.propertyContentObserver.observe(this.propertyContent.nativeElement, { childList: true });

    this.property.loaded$.next(true);
    if (this.ioType === IoType.INPUT) {
      this.mappingService.checkForDbConnections(this.property);
    }

    this.cdr.detectChanges();
  }

  private createParentConnection(): void {
    if (this.isLast && this.el && this.parentReference) {
      const elBoundingRect = this.el.nativeElement.getBoundingClientRect();
      const parentBoundingRect = this.parentReference.getBoundingClientRect();
      this.connectionStyle = {
        height: `${elBoundingRect.top - parentBoundingRect.bottom + 30}px`,
      };
    } else {
      this.connectionStyle = null;
    }
  }

  private createPropertyValueItems(): void {
    if (this.property.type === MappingDataType.boolean) {
      this.propertyItems = [
        { label: 'True', value: true },
        { label: 'False', value: false },
      ];
    } else {
      this.propertyItems = this.property.enum.map(item => ({ value: item, label: item }));
    }
  }

  public onSelectProperty(): void {
    this.isSelected = true;
    if (this.hasConnection) {
      this.mappingService.transparentizeNotActiveConnections(this.ioType, this.property.path);
    }
    if (this.property.type !== MappingDataType.object && this.ioType === IoType.INPUT && !this.propertyForm) {
      this.initValueTypeForm();
      this.initPropertyForm();
    }
  }

  public onClickOutside(event: Event): void {
    if (this.isSelected) {
      if (!this.isPropertyClicked(event)) {
        this.mappingService.removeConnectionsTransparency();
      }
      this.isSelected = false;
      if (!this.property.isCustom && !this.propertyForm?.get('propertyValue').value) {
        this.propertyForm = null;
        this.valueTypeForm = null;
        this.property.isValidationError = false;
        this.property.valueType = null;
      }
    }
  }

  private initPropertyForm(): void {
    this.propertyForm = new FormGroup({ propertyValue: new FormControl(this.property.value || null) });
    this.subscriptions$.add(this.propertyForm.valueChanges.subscribe(val => {
      this.property.value = val.propertyValue;
      this.property.isValidationError = !isValidType(this.property.type, this.property.value);
    }));
  }

  private initValueTypeForm(): void {
    this.valueTypeForm = new FormGroup({ valueType: new FormControl(this.property.valueType || 'default') });
    if (!this.property.valueType) {
      this.property.valueType = 'default';
    }

    this.subscriptions$.add(this.valueTypeForm.valueChanges.subscribe(({ valueType }) => {
      this.property.valueType = valueType;
      if (valueType === 'static' && this.hasConnection) {
        this.mappingService.removeIoConnection(this.ioType, this.property.path);
      }
    }));
  }

  private onSectionUIUpdate(): void {
    this.subscriptions$.add(this.mappingService.sectionUIUpdated$.subscribe(ioType => {
      if (ioType === this.ioType) {
        this.createParentConnection();
        this.cdr.detectChanges();
      }
    }));
  }

  private onConnectionPick(): void {
    this.subscriptions$.add(this.mappingService.connectionPicked$.pipe(
      tap(data => {
        this.checkIfPicked(data);
        this.cdr.detectChanges();
      }),
      filter(({ ioType }) => ioType !== this.ioType)).subscribe((connectionData) => {
      this.checkForCompatibility(connectionData);
    }));
  }

  private onConnectionDrop(): void {
    this.subscriptions$.add(this.mappingService.connectionDropped$.subscribe(() => {
      if (this.isPicked) {
        this.isPicked = false;
      }
      if (this.isCompatible) {
        this.isCompatible = false;
      }
      this.isConnectionError = false;
      this.cdr.detectChanges();
    }));
  }

  private onConnectionCreated(): void {
    this.subscriptions$.add(this.mappingService.connectionCreated$
      .pipe(filter(connection => connection && connection[this.ioType.toLowerCase()].path === this.property.path))
      .subscribe((connection) => {
        this.connections.push(connection);
        this.hasConnection = true;
        if (this.dotHovered) {
          this.dotHovered = false;
        }
        this.cdr.detectChanges();
      }));
  }

  private onConnectionRemoved(): void {
    this.subscriptions$.add(this.mappingService.connectionRemoved$.pipe(
      filter(connection => connection && connection[this.ioType.toLowerCase()].path === this.property.path),
    ).subscribe((connection) => {
      const connectionIndex = this.connections.findIndex(({ id }) => id === connection.id);
      if (connectionIndex > -1) {
        this.connections.splice(connectionIndex, 1);
      }
      if (!this.connections.length) {
        this.hasConnection = false;
        this.cdr.detectChanges();
      }
    }));
  }

  private checkIfPicked(data: { ioType: IoType, property: MappingProperty }): void {
    this.isPicked = data.ioType === this.ioType && data.property.path === this.property.path;
  }

  private checkForCompatibility(data: { ioType: IoType, property: MappingProperty }): void {
    const inputSchema = this.ioType === IoType.INPUT ? this.property : data.property;
    const outputSchema = this.ioType === IoType.INPUT ? data.property : this.property;
    this.isCompatible = this.mappingService.isSchemasCompatible(outputSchema, inputSchema);
    if (this.isCompatible) {
      this.cdr.detectChanges();
    }
  }

  public pickConnection(event: PointerEvent): void {
    this.stopEvent(event);
    if (this.property.valueType !== 'static') {
      this.mappingService.pickConnection(this.getDotCoordinates(), this.property, this.ioType);
    }
  }

  public getDotCoordinates(): Coordinates {
    const boundingRect = this.connectionEdge?.nativeElement?.getBoundingClientRect();
    if (boundingRect) {
      return {
        x: boundingRect.left + (boundingRect.width / 2),
        y: boundingRect.top + (boundingRect.height / 2),
      };
    }
  }

  public isPropertyClicked(event: any): boolean {
    return !!event.path.find(el => el.classList && el.classList.contains('io-property'));
  }

  public tryToConnect(event: PointerEvent): void {
    this.stopEvent(event);
    if (this.isCompatible && this.property.valueType !== 'static') {
      if (this.hasConnection && this.ioType === IoType.INPUT) {
        this.mappingService.removeIoConnection(this.ioType, this.property.path);
      }
      this.mappingService.tryToConnect(this.ioType, this.property, this.getDotCoordinates());
    } else {
      this.mappingService.removeActiveConnection();
      this.mappingService.triggerConnectionDrop();
    }
  }

  public getPropertyData(): MappingProperty {
    return this.property;
  }

  public getIoType(): IoType {
    return this.ioType;
  }

  private stopEvent(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
  }

  public highlightConnection(): void {
    const activeConnection = this.mappingService.getActiveConnection();
    if (activeConnection) {
      if (!this.isCompatible && !this.isPicked) {
        this.isConnectionError = true;
        this.mappingService.highlightConnection(activeConnection, this.ioType);
      }
      if (this.hasConnection && this.ioType === IoType.INPUT) {
        this.dotHovered = true;
      }
    }
  }

  public removeConnectionHighlight(): void {
    const activeConnection = this.mappingService.getActiveConnection();
    if (activeConnection) {
      if (!this.isCompatible && !this.isPicked) {
        this.isConnectionError = false;
        this.mappingService.removeHighlightFromConnection(activeConnection);
        this.cdr.detectChanges();
      }
    }
    if (this.dotHovered) {
      this.dotHovered = false;
    }
  }

  public onRemoveProperty(event: Event): void {
    this.stopEvent(event);

    if (this.hasConnection) {
      this.mappingService.removeIoConnection(this.ioType, this.property?.path);
    }
    this.removeProperty.emit(this.property);
  }

  public checkChildConnections(): void {
    if (this.property.type === MappingDataType.object) {
      const linkedProperty = this.mappingService.getLinkedProperty(this.property, this.ioType);
      if (linkedProperty) {
        this.mappingService.createPseudoConnection(
          this.ioType === IoType.INPUT ? linkedProperty : this.property,
          this.ioType === IoType.INPUT ? this.property : linkedProperty,
        );
      }
    }
  }

  public get isValid(): boolean {
    return this.mappingService.isPropertyValid(this.property);
  }

  public removeHighlight(): void {
    this.mappingService.removePseudoConnection();
  }

  ngOnDestroy(): void {
    try {
      this.subscriptions$.unsubscribe();
    } catch (e) {
    }
  }
}
