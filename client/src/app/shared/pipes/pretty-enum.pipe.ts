import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'prettyEnum'
})
export class PrettyEnumPipe implements PipeTransform {
  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      return '';
    }
    return value.split(/[\_,\-,\s]+/)
      .map(i => `${i.substr(0, 1).toUpperCase()}${i.substr(1).toLowerCase()}`)
      .join(' ');
  }
}
