if (!(Promise as any).try) {
  (Promise as any).try = async function(func: any, ...args: any[]) {
    return func(...args);
  };
}
