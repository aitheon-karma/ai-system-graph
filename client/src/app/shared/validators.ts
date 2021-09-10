import { AbstractControl } from '@angular/forms';

const json = (control: AbstractControl): { [key: string]: any } | null => {
  const { value } = control;
  try {
    JSON.parse(value);
  } catch (e) {
    return { invalidJSON: true };
  }
  return null;
};

const number = (control: AbstractControl): { [key: string]: any } | null => {
  const { value } = control;
  if (Number(value) === 0 || !!Number(value)) {
    return null;
  }
  return { notNumber: true };
};

export const CustomValidators = {
  json,
  number,
};
