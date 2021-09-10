export const isIoMultiple = (type: 'input' | 'output', multiple: boolean, isChannel: boolean): boolean => {
  if (type === 'input' && isChannel) {
    return true;
  }
  if (type === 'output' && isChannel) {
    return false;
  }
  return multiple;
};
