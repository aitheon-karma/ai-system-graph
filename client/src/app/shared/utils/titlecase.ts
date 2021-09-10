export const titleCase = (val: string): string => {
  if (!val || typeof val !== 'string') {
    return '';
  }
  return val.split(' ')
    .map(item => `${item.substr(0, 1).toUpperCase()}${item.substr(1).toLowerCase()}`).join(' ');
};
