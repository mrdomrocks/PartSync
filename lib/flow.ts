export function isHandheldFlow(pathname: string): boolean {
  return (
    /^\/items\/[^/]+\/take\/?$/.test(pathname) || /^\/boms\/[^/]+\/take\/?$/.test(pathname)
  );
}
