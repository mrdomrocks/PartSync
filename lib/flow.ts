export function isHandheldFlow(pathname: string): boolean {
  return /^\/items\/[^/]+\/take\/?$/.test(pathname);
}
