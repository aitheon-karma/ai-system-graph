
export enum Accesses {
  CORE_GRAPH_ACCESS = 'CORE_GRAPH_ACCESS',
  SOCKETS_ACCESS = 'SOCKETS_ACCESS'
}

export function hasGraphAccess(user: any, role: Accesses) {
  let hasAccess = user.sysadmin || user.sysManager;
  switch (role) {
    case Accesses.CORE_GRAPH_ACCESS:
      hasAccess = hasAccess || user.hasCoreGraphAccess;
      break;
    case Accesses.SOCKETS_ACCESS:
      hasAccess = hasAccess || user.hasSocketsAccess;
      break;
  }
  return hasAccess;
}
