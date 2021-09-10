import { Coordinates } from '@aitheon/core-client';
import { MappingDataType } from '../enums/mapping-data-type.enum';
import { BehaviorSubject } from 'rxjs';

export interface MappingProperty {
  propertyName: string;
  type: MappingDataType;
  nestingLevel: number;
  path: string;
  loaded$: BehaviorSubject<boolean>;
  description?: string;
  enum?: string[];
  default?: string;
  required?: boolean;
  coordinates?: Coordinates;
  el?: HTMLElement;
  isCustom?: boolean;
  value?: any;
  isValidationError?: boolean;
  valueType?: 'static' | 'default';
  nestedProperties?: MappingProperty[];
  isAnyData?: boolean;
}
