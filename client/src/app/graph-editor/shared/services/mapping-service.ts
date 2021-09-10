import { Coordinates } from '@aitheon/core-client';
import { Mapping, PredefinedElement, SocketMetadata } from '@aitheon/system-graph';
import { Injectable, OnDestroy } from '@angular/core';
import * as d3Shape from 'd3-shape';

import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { IoType } from '../../../shared/enums/io-type.enum';
import { MappingDataType } from '../../../shared/enums/mapping-data-type.enum';
import { MappingProperty } from '../../../shared/interfaces/mapping-property.interface';
import { SharedService } from '../../../shared/services/shared.service';

export interface MappingConnection {
  id: string;
  svgPath: any;
  isExisting?: boolean;
  isPseudoConnection?: boolean;
  connectedSide?: IoType;
  isTransparent?: boolean;
  input?: MappingProperty;
  output?: MappingProperty;
}

@Injectable({
  providedIn: 'root'
})
export class MappingService implements OnDestroy {
  private _svg: any;
  private _connections$: BehaviorSubject<MappingConnection[]> = new BehaviorSubject<MappingConnection[]>([]);
  private _connections: MappingConnection[] = [];
  private _dbConnections: (Mapping | PredefinedElement)[] = [];
  private _connectionPicked$ = new Subject<{
    ioType: IoType,
    property: MappingProperty;
  }>();
  private _inputProperties: MappingProperty[];
  private _outputProperties: MappingProperty[];
  private _customProperties: MappingProperty[] = [];
  private _selectedConnections$ = new Subject<MappingConnection[]>();
  private _connectionDropped$ = new Subject<void>();
  private _connectionCreated$ = new Subject<MappingConnection>();
  private _connectionRemoved$ = new Subject<MappingConnection>();
  private _sectionUIUpdated$ = new Subject<IoType>();
  private _submitted$ = new Subject<boolean>();
  private _ioSet$ = {
    input$: new BehaviorSubject<SocketMetadata>(null),
    output$: new BehaviorSubject<SocketMetadata>(null),
  };

  private activeConnection: MappingConnection;
  private pseudoConnection: MappingConnection;
  private connectionCurvature = 0.25;
  private curve = d3Shape.curveCatmullRom.alpha(1);

  constructor(
    private sharedService: SharedService,
  ) {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.addPointerUpListener();
  }

  public get connections$(): Observable<MappingConnection[]> {
    return this._connections$.asObservable();
  }

  public get connectionPicked$(): Observable<{
    ioType: IoType,
    property: MappingProperty;
  }> {
    return this._connectionPicked$.asObservable();
  }

  public get connectionDropped$(): Observable<void> {
    return this._connectionDropped$.asObservable();
  }

  public get connectionCreated$(): Observable<MappingConnection> {
    return this._connectionCreated$.asObservable();
  }

  public get connectionRemoved$(): Observable<MappingConnection> {
    return this._connectionRemoved$.asObservable();
  }

  public get sectionUIUpdated$(): Observable<IoType> {
    return this._sectionUIUpdated$.asObservable();
  }

  public get selectedConnections$(): Observable<MappingConnection[]> {
    return this._selectedConnections$.asObservable();
  }

  public get submitted$(): Observable<boolean> {
    return this._submitted$.asObservable();
  }

  public get inputSet$(): Observable<SocketMetadata> {
    return this._ioSet$.input$.asObservable();
  }

  public get outputSet$(): Observable<SocketMetadata> {
    return this._ioSet$.output$.asObservable();
  }

  public get inputProperties(): MappingProperty[] {
    return this._inputProperties;
  }

  public set inputProperties(properties) {
    this._inputProperties = properties;
  }

  public get outputProperties(): MappingProperty[] {
    return this._outputProperties;
  }

  public set outputProperties(properties) {
    this._outputProperties = properties;
  }

  public get customProperties(): MappingProperty[] {
    return this._customProperties;
  }

  public set customProperties(properties: MappingProperty[]) {
    this._customProperties = properties;
  }

  public addCustomProperty(property: MappingProperty): void {
    this._customProperties.push(property);
  }

  public setSvgSelection(svg: any): void {
    this._svg = svg;

    this.createSvgDefs();
  }

  get svg() {
    return this._svg;
  }

  get svgAsHTML(): HTMLElement {
    return this._svg.node();
  }

  public get connections(): MappingConnection[] {
    return this._connections;
  }

  public setIo(ioType: IoType, io: SocketMetadata): void {
    if (ioType === IoType.INPUT) {
      this._ioSet$.input$.next(io);
    } else {
      this._ioSet$.output$.next(io);
    }
  }

  createSvgDefs(): void {
    const defs = this._svg.append('defs');
    // left to right path pattern
    const leftToRightGradient = defs
      .append('linearGradient')
      .attr('id', 'left-to-right')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%');

    leftToRightGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#dcbc65');

    leftToRightGradient.append('stop')
      .attr('offset', '45%')
      .attr('stop-color', '#dcbc65');

    leftToRightGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#e96058');

    const rightToLeftGradient = defs
      .append('linearGradient')
      .attr('id', 'right-to-left')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%');

    rightToLeftGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#e96058');

    rightToLeftGradient.append('stop')
      .attr('offset', '55%')
      .attr('stop-color', '#dcbc65');

    rightToLeftGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#dcbc65');
  }

  public clearConnections(): void {
    for (const connection of this.connections) {
      connection.svgPath.remove();
      this._connectionRemoved$.next(connection);
    }
    this._connections = [];
    this._connections$.next(this.connections);
    this.removeActiveConnection();
    this.removePseudoConnection();
  }

  public removeActiveConnection(): void {
    if (this.activeConnection) {
      this.removeConnection(this.activeConnection);
      if (this.activeConnection.isExisting) {
        this._connectionRemoved$.next(this.activeConnection);
      }
      this.activeConnection = null;
    }
  }

  public getConnectionsByIo(ioType: IoType, path: string): MappingConnection[] {
    return this.connections.filter(connection => connection && connection[ioType.toLowerCase()].path === path);
  }

  public getCoordinatesFromElement(el: HTMLElement): Coordinates {
    const boundingRect = el?.getBoundingClientRect();
    if (boundingRect) {
      return {
        x: Math.round(boundingRect.x + (boundingRect.width / 2)),
        y: Math.round(boundingRect.y + (boundingRect.height / 2)),
      };
    }
  }

  public getRelativePositionToElementByClientCoordinates(relativeEl: HTMLElement, coordinates: Coordinates): Coordinates {
    const boundingRect = relativeEl?.getBoundingClientRect();
    if (boundingRect) {
      return {
        x: Math.round(coordinates.x - boundingRect.x),
        y: Math.round(coordinates.y - boundingRect.y),
      };
    }
  }

  public pickConnection(edgeCoordinates: Coordinates, property: MappingProperty, ioType: IoType): void {
    this.addPointerMoveListener();
    if (ioType === IoType.INPUT) {
      const existingConnection = this.connections.find(connection => connection.input.path === property.path);
      if (existingConnection) {
        this.pickExistingConnection(existingConnection);
        return;
      }
    }
    const relativeCoordinates = this.getRelativePositionToElementByClientCoordinates(this.svgAsHTML, edgeCoordinates);
    this.createNewConnection(relativeCoordinates, property, ioType);
  }

  private hasConnection(ioType: IoType, path: string): boolean {
    return !!this.connections.find(connection => connection[ioType.toLowerCase()].path === path);
  }

  pickExistingConnection(connection: MappingConnection): void {
    connection.connectedSide = IoType.OUTPUT;
    this.activeConnection = connection;
    this.emitConnectionPick(connection, 'output');
  }

  emitConnectionPick(connection: MappingConnection, key: 'input' | 'output'): void {
    const io = connection[key];
    this._connectionPicked$.next({
      ioType: connection.connectedSide,
      property: io
    });
  }

  public tryToConnect(ioType: IoType, property: MappingProperty, edgeCoordinates: Coordinates): void {
    this.activeConnection[ioType.toLowerCase()] = property;

    if (!this.activeConnection.input.isAnyData &&
      this.activeConnection.input.type === MappingDataType.object &&
      this.activeConnection.output.type === MappingDataType.object) {
      this.createChildConnections(this.activeConnection.output, this.activeConnection.input);
      return;
    }

    this.activeConnection[ioType.toLowerCase()].coordinates = this.getRelativePositionToElementByClientCoordinates(
      this.svgAsHTML,
      edgeCoordinates,
    );
    this.updateConnection(this.activeConnection, this.activeConnection.output.coordinates, this.activeConnection.input.coordinates);
    if (this.activeConnection.isExisting) {
      this.updateExistingConnection();
    } else {
      this.activeConnection.isExisting = true;
      this._connections.push(this.activeConnection);
      this._connections$.next(this.connections);
    }
    this._connectionCreated$.next(this.activeConnection);
    this._connectionDropped$.next();
    this.activeConnection = null;
    this.removePointerMoveListener();
  }

  createChildConnections(outputProperty: MappingProperty, inputProperty: MappingProperty): void {
    if (inputProperty.nestedProperties?.length) {
      for (const property of inputProperty.nestedProperties) {
        const opposite = outputProperty.nestedProperties?.find(({ propertyName }) => propertyName === property.propertyName);
        if (property.type !== MappingDataType.object || property.isAnyData) {
          if (opposite && this.isSchemasCompatible(opposite, property) && !this.hasConnection(IoType.INPUT, property.path)) {
            this.createConnection(opposite, property);
          }
        } else if (opposite && opposite.type === MappingDataType.object) {
          this.createChildConnections(opposite, property);
        }
      }
    }
    this.removeActiveConnection();
    this._connectionDropped$.next();
  }

  private createConnection(outputProperty: MappingProperty, inputProperty, isPseudoConnection?: boolean): void | MappingConnection {
    const outputClientCoordinates = this.getCoordinatesFromElement(outputProperty.el);
    const inputClientCoordinates = this.getCoordinatesFromElement(inputProperty.el);
    const outputRelativeCoordinates = this.getRelativePositionToElementByClientCoordinates(this.svgAsHTML, outputClientCoordinates);
    const inputRelativeCoordinates = this.getRelativePositionToElementByClientCoordinates(this.svgAsHTML, inputClientCoordinates);
    const pathData = this.getPathData(outputRelativeCoordinates, inputRelativeCoordinates);
    inputProperty.coordinates = inputRelativeCoordinates;
    outputProperty.coordinates = outputRelativeCoordinates;
    const connection = {
      input: inputProperty,
      output: outputProperty,
      isPseudoConnection,
      id: this.sharedService.uuidv4Generator(),
      isExisting: true,
      isTransparent: isPseudoConnection,
      svgPath: this.createPath(pathData, isPseudoConnection),
    };
    if (isPseudoConnection) {
      this.pseudoConnection = connection;
      connection.svgPath.style('opacity', 0.2);
    } else {
      this._connections.push(connection);
      this._connections$.next(this.connections);
    }
    this._connectionCreated$.next(connection);
  }

  public createPseudoConnection(outputProperty: MappingProperty, inputProperty: MappingProperty): void {
    this.createConnection(outputProperty, inputProperty, true);
  }

  public removePseudoConnection(): void {
    if (this.pseudoConnection) {
      this.removeConnection(this.pseudoConnection);
      this.pseudoConnection = null;
    }
  }

  private updateExistingConnection(): void {
    const connection = this.connections.find(({ id }) => id === this.activeConnection.id);
    if (connection) {
      connection.input = this.activeConnection.input;
      connection.output = this.activeConnection.output;
      connection.connectedSide = null;
    }
  }

  private createNewConnection(startCoordinates: Coordinates, property: MappingProperty, ioType: IoType): void {
    const ioData = {
      ...property,
      coordinates: startCoordinates,
    } as MappingProperty;
    const pathData = this.getPathData(startCoordinates, startCoordinates);
    this.activeConnection = {
      connectedSide: ioType,
      [ioType.toLowerCase()]: ioData,
      id: this.sharedService.uuidv4Generator(),
      svgPath: this.createPath(pathData),
    } as unknown as MappingConnection;
    this.emitConnectionPick(this.activeConnection, ioType.toLowerCase() as any);
  }

  createPath(pathData: string, isPseudoConnection?: boolean): any {
    return this.svg.append('path')
      .attr('d', pathData)
      .style('z-index', '3')
      .attr('fill', 'transparent')
      .attr('stroke', '#dcbc65')
      .style('opacity', isPseudoConnection ? 0 : 1)
      .attr('stroke-width', 2);
  }

  getPathData(startCoordinates: Coordinates, endCoordinates: Coordinates): string {
    const curveStep = Math.abs(endCoordinates.x - startCoordinates.x) * this.connectionCurvature;
    const hx1 = startCoordinates.x + curveStep;
    const hx2 = endCoordinates.x - curveStep;
    return d3Shape.line()
      .x(d => d[0])
      .y(d => d[1])
      .curve(this.curve)
      ([
        [startCoordinates.x, startCoordinates.y],
        [hx1, startCoordinates.y],
        [hx2, endCoordinates.y],
        [endCoordinates.x, endCoordinates.y],
      ]);
  }

  private addPointerMoveListener(): void {
    window.addEventListener('pointermove', this.onPointerMove);
  }

  private addPointerUpListener(): void {
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.activeConnection) {
      const relativeCoordinates = this.getRelativePositionToElementByClientCoordinates(this.svgAsHTML, {
        x: event.clientX,
        y: event.clientY,
      });
      let start, end;
      if (this.activeConnection.connectedSide === IoType.OUTPUT) {
        start = this.activeConnection.output.coordinates;
        end = relativeCoordinates;
      } else {
        start = relativeCoordinates;
        end = this.activeConnection.input.coordinates;
      }
      this.updateConnection(this.activeConnection, start, end);
    }
  }

  updateConnection(connection: MappingConnection, startCoordinates: Coordinates, endCoordinates: Coordinates): void {
    const pathData = this.getPathData(startCoordinates, endCoordinates);
    connection.svgPath.data([{ startCoordinates, endCoordinates }]).attr('d', pathData);
  }

  private onPointerUp(event?: PointerEvent): void {
    this.removeActiveConnection();
    this.removePointerMoveListener();
    this._connectionDropped$.next();
  }

  public getLinkedProperty(property: MappingProperty, ioType: IoType): MappingProperty {
    if (property.nestedProperties?.length) {
      for (const prop of property.nestedProperties) {
        if (prop.type !== MappingDataType.object) {
          const propConnections = this.getConnectionsByIo(ioType, prop.path);
          if (propConnections?.length) {
            for (const connection of propConnections) {
              const linked = this.getPropertyParentFromProperties(
                ioType === IoType.INPUT ? this.outputProperties : this.inputProperties,
                connection[ioType === IoType.INPUT ? 'output' : 'input'].path
              );
              if (linked) {
                return linked;
              }
            }
          }
        } else {
          const linked = this.getLinkedProperty(prop, ioType);
          if (linked) {
            return linked;
          }
        }
      }
    }
    return null;
  }

  public getPropertyParentFromProperties(properties: MappingProperty[], childPropertyPath: string): MappingProperty {
    for (const property of properties) {
      const parent = this.getPropertyParent(property, childPropertyPath);
      if (parent) {
        return parent;
      }
    }
    return null;
  }

  public getPropertyParent(parentProperty: MappingProperty, childPropertyPath: string): MappingProperty {
    if (parentProperty.nestedProperties) {
      for (const prop of parentProperty.nestedProperties) {
        if (prop.path === childPropertyPath) {
          return parentProperty;
        }
        if (prop.nestedProperties) {
          const parent = this.getPropertyParent(prop, childPropertyPath);
          if (parent) {
            return parent;
          }
        }
      }
    }
    return null;
  }

  public isSchemasCompatible(outputSchema: MappingProperty, inputSchema: MappingProperty): boolean {
    // any-data socket validation
    if (inputSchema.isAnyData && outputSchema.required) {
      return true;
    }

    // primitives validation
    if (inputSchema.type !== outputSchema.type && inputSchema.type !== MappingDataType.string) {
      return false;
    }

    if (inputSchema.type !== MappingDataType.object && inputSchema.required && !outputSchema.required && !inputSchema.valueType) {
      return false;
    }

    if (inputSchema.type !== MappingDataType.object) {
      return true;
    }

    // objects validation
    if (inputSchema?.nestedProperties?.length) {
      for (const schema of inputSchema?.nestedProperties) {
        const opposite = outputSchema.nestedProperties?.find(({ propertyName }) => propertyName === schema.propertyName);
        if (opposite && this.isSchemasCompatible(opposite, schema)) {
          return true;
        }
      }
    }

    return false;
  }

  public updateConnectionsUI(scrolling?: 'input' | 'output'): void {
    for (const connection of this.connections) {
      if (scrolling) {
        const clientCoordinates = this.getCoordinatesFromElement(connection[scrolling].el);
        connection[scrolling].coordinates = this.getRelativePositionToElementByClientCoordinates(this.svgAsHTML, clientCoordinates);
        this.updateConnection(connection, connection.output.coordinates, connection.input.coordinates);
      } else {
        this.updateConnectionUI(connection);
      }
    }
    if (this.activeConnection) {
      this.updateActiveConnectionUI();
    }
    if (this.pseudoConnection) {
      this.updateConnectionUI(this.pseudoConnection);
    }
  }

  private updateConnectionUI(connection: MappingConnection): void {
    const inputClientCoordinates = this.getCoordinatesFromElement(connection.input.el);
    const outputClientCoordinates = this.getCoordinatesFromElement(connection.output.el);
    connection.input.coordinates = this.getRelativePositionToElementByClientCoordinates(this.svgAsHTML, inputClientCoordinates);
    connection.output.coordinates = this.getRelativePositionToElementByClientCoordinates(this.svgAsHTML, outputClientCoordinates);
    this.updateConnection(connection, connection.output.coordinates, connection.input.coordinates);
  }

  updateActiveConnectionUI(): void {
    const [data] = this.activeConnection.svgPath.data();
    if (data) {
      let { startCoordinates, endCoordinates } = data;
      if (this.activeConnection.connectedSide === IoType.OUTPUT) {
        startCoordinates = this.getRelativePositionToElementByClientCoordinates(
          this.svgAsHTML,
          this.getCoordinatesFromElement(this.activeConnection.output.el)
        );
        this.activeConnection.output.coordinates = startCoordinates;
      } else {
        endCoordinates = this.getRelativePositionToElementByClientCoordinates(
          this.svgAsHTML,
          this.getCoordinatesFromElement(this.activeConnection.input.el)
        );
        this.activeConnection.input.coordinates = endCoordinates;
      }
      this.updateConnection(this.activeConnection, startCoordinates, endCoordinates);
    }
  }

  public triggerConnectionDrop(): void {
    this._connectionDropped$.next();
  }

  public removeIoConnection(ioType: IoType, path: string): void {
    const connection = this.connections.find(c => c[ioType.toLowerCase()].path === path);
    if (connection) {
      this.removeConnection(connection);
    }
  }

  public removeConnection(connection: MappingConnection): void {
    connection.svgPath?.remove();
    if (connection.isExisting) {
      this._connectionRemoved$.next(connection);
    }
    this._connections = this.connections.filter(({ id }) => id !== connection.id);
    this._connections$.next(this.connections);
  }

  public getActiveConnection(): MappingConnection {
    return this.activeConnection;
  }

  public highlightConnection(connection: MappingConnection, ioType?: IoType): void {
    if (ioType === IoType.INPUT) {
      connection.svgPath.attr('stroke', 'url(#left-to-right)');
    } else {
      connection.svgPath.attr('stroke', 'url(#right-to-left)');
    }
  }

  public removeHighlightFromConnection(connection: MappingConnection): void {
    connection?.svgPath?.attr('stroke', '#dcbc65');
  }

  public transparentizeNotActiveConnections(ioType: IoType, path: string): void {
    const propertyConnections = this.getConnectionsByIo(ioType, path);
    this._selectedConnections$.next(propertyConnections);
    const propertyConnectionsIds = propertyConnections.map(c => c.id);
    if (propertyConnectionsIds.length) {
      for (const connection of this.connections) {
        if (!propertyConnectionsIds.includes(connection.id)) {
          connection.svgPath.style('opacity', 0.2);
          connection.isTransparent = true;
        } else {
          connection.isTransparent = false;
          connection.svgPath.style('opacity', 1);
        }
      }
    }
  }

  removeConnectionsTransparency(): void {
    this._selectedConnections$.next([]);
    for (const connection of this.connections) {
      connection.isTransparent = false;
      connection.svgPath.style('opacity', 1);
    }
  }

  public updateSectionUI(ioType: IoType): void {
    this.updateConnectionsUI(ioType.toLowerCase() as any);
    this._sectionUIUpdated$.next(ioType);
  }

  public isPropertyValid(property: MappingProperty): boolean {
    if (property.type === MappingDataType.object) {
      return true;
    }
    if (property.isValidationError) {
      return false;
    }
    if (property.required) {
      const [propertyConnection] = this.getConnectionsByIo(IoType.INPUT, property.path);
      if (property.valueType) {
        if (property.valueType === 'static' && !this.isValueInvalid(property.value)) {
          return true;
        }
        if (property.valueType === 'default' && !propertyConnection) {
          return false;
        }
        if (this.isValueInvalid(property.value)) {
          return false;
        }
      }
      if (!propertyConnection) {
        return false;
      }
      if (propertyConnection.output.isValidationError) {
        return false;
      }
      if (propertyConnection.output.isCustom && this.isValueInvalid(propertyConnection.output.value)) {
        return false;
      }
    }
    return true;
  }

  isPropertyRecursivelyValid(property: MappingProperty): boolean {
    if (!this.isPropertyValid(property)) {
      return false;
    }
    if (property.nestedProperties) {
      for (const prop of property.nestedProperties) {
        if (!this.isPropertyValid(prop)) {
          return false;
        }
      }
    }
    return true;
  }

  isPropertiesValid(properties: MappingProperty[]): boolean {
    for (const property of properties) {
      if (!this.isPropertyRecursivelyValid(property)) {
        return false;
      }
    }
    return true;
  }

  isValueInvalid(value: any): boolean {
    return !value && value !== 0 && value !== false;
  }

  public createMapping(): Observable<any> {
    return new Observable(subscriber => {
      if (!this.isPropertiesValid(this.inputProperties)) {
        throw new Error('Mapping is invalid');
      }
      const mapping = [];
      const customFields = [];
      for (const connection of this.connections) {
        if (connection.output.isCustom) {
          customFields.push({
            to: connection.input.path,
            value: connection.output.value,
          });
        } else {
          const mappingObject = {
            from: connection.output.path,
            to: connection.input.path,
          } as any;
          if (connection.input.valueType === 'default') {
            mappingObject.defaultValue = connection.input.value;
          }
          mapping.push(mappingObject);
        }
      }
      const staticFields = this.getAllStaticFields(this.inputProperties, []);

      subscriber.next({
        mapping,
        customFields,
        staticFields,
      });
    });
  }

  getAllStaticFields(properties: MappingProperty[], staticFields: PredefinedElement[]): PredefinedElement[] {
    for (const property of properties) {
      if (property.valueType === 'static') {
        staticFields.push({ to: property.path, value: property.value });
      }
      if (property.nestedProperties) {
        this.getAllStaticFields(property.nestedProperties, staticFields);
      }
    }
    return staticFields;
  }

  public setDbConnections(connections: (Mapping | PredefinedElement)[]): void {
    this._dbConnections = connections;
  }

  public checkForDbConnections(property: MappingProperty): void {
    const inputDbConnection = this._dbConnections.find(({ to }) => to === property.path);
    if (inputDbConnection) {
      this._dbConnections = this._dbConnections.filter(({ to }) => to !== property.path);
      let outputProperty;
      if (inputDbConnection.hasOwnProperty('value')) {
        outputProperty = this.customProperties.find(p => p.value === (inputDbConnection as PredefinedElement).value);
      } else {
        outputProperty = this.getPropertyByPath(this.outputProperties, (inputDbConnection as Mapping).from);
      }
      if (outputProperty) {
        outputProperty.loaded$.asObservable().pipe(
          take(1),
          filter(l => !!l)
        ).subscribe(() => {
          this.createConnection(outputProperty, property);
        });
      }
    }
  }

  getPropertyByPath(properties: MappingProperty[], path: string): MappingProperty {
    for (const property of properties) {
      if (property.path === path) {
        return property;
      }
      if (property.nestedProperties) {
        const prop = this.getPropertyByPath(property.nestedProperties, path);
        if (prop) {
          return prop;
        }
      }
    }
    return null;
  }

  connectAll(): void {
    this.createChildConnections({
        nestedProperties: this.outputProperties,
      } as any,
      {
        nestedProperties: this.inputProperties,
      } as any);
  }

  public setSubmitted(submitted: boolean): void {
    this._submitted$.next(submitted);
  }

  removePointerMoveListener(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointerup', this.onPointerUp);
  }
}
