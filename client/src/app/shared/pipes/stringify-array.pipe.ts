import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'stringifyArray'
})
export class StringifyArrayPipe implements PipeTransform {
  transform(value: any[], separator: string = ',', takeField?: string, adornment?: string): any {
    if (Array.isArray(value)) {
      return value.map((item, i) => `${adornment || ''}${takeField
        ? item[takeField] : item}${adornment || ''}${i === value.length - 1 ? '' : separator}`).join(' ').trim();
    }
    return value;
  }
}

