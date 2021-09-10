import { SocketPlacement } from '../../../shared/enums/socket-placement.enum';

export const getIoPlacement = (
  placement: SocketPlacement,
  type: 'input' | 'output',
  side: SocketPlacement,
): SocketPlacement => {
  if (placement === SocketPlacement.CENTER) {
    if (type === 'input' && side === SocketPlacement.RIGHT) {
      return SocketPlacement.RIGHT;
    }
    if (type === 'output' && side === SocketPlacement.LEFT) {
      return SocketPlacement.LEFT;
    }
    return null;
  }
  if (type === 'input' && placement === SocketPlacement.RIGHT) {
    return SocketPlacement.RIGHT;
  }
  if (type === 'output' && placement === SocketPlacement.LEFT) {
    return SocketPlacement.LEFT;
  }
  return null;
};
