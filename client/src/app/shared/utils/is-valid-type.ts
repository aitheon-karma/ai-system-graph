import { MappingDataType } from '../enums/mapping-data-type.enum';

export const isValidType = (type: MappingDataType, value: any): boolean => {
  if (value !== 0 && value !== false && !value) {
    return false;
  }
  switch (type) {
    case MappingDataType.integer:
      return isNumber(value);
    case MappingDataType.boolean:
      return isBoolean(value);
    case MappingDataType.string:
      return typeof value === 'string';
    case MappingDataType.array:
      return isArray(value);
    default:
      return false;
  }
};

const isNumber = (value: any): boolean => {
    return Number(value) === 0 || !!Number(value);
};

const isBoolean = (value: any): boolean => {
  return typeof value === 'boolean' || value === 'true' || value === 'false';
};

const isArray = (value: any): boolean => {
  if (Array.isArray(value)) {
    return true;
  }
  try {
    if (typeof value === 'string' && value.indexOf('[') === 0 && value.lastIndexOf(']') === value.length - 1) {
      JSON.parse(`{ "test": ${value} }`);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};
