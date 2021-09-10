export const get = (object: { [key: string]: any }, path: any[] | string, defaultValue: any = null) => {
  try {
    const keys = Array.isArray(path) ? path : (path || '').split('.');
    const result = (object || {})[keys[0]];
    if (result && keys.length > 1) {
      return get(result, keys.slice(1), defaultValue);
    }
    return result !== undefined ? result : defaultValue;
  } catch (e) {
    console.warn(e);
    return defaultValue;
  }
};
