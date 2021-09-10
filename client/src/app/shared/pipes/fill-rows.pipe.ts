import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'fillRows'})
export class FillRowsPipe implements PipeTransform {
  transform(value, size: number = 10) {
    const missing = size - (value ? value.length : 0);
    if (missing < 0) {
      return value;
    }
    return [...value, ...new Array(missing).fill(null)];
  }
}
