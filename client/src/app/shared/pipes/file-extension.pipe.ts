import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'fileExtension'})
export class FileExtensionPipe implements PipeTransform {
  transform(value: string) {
    if (!value)
      return '';

    const lastDotIndex = value.lastIndexOf('.');
    if (lastDotIndex >= 0)
      return value.substring(lastDotIndex + 1);

    return value;
  }
}
