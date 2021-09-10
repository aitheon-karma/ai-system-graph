import { SocketPlacement } from '../../../shared/enums/socket-placement.enum';

export const getIoMetadataFromKey = (ioKey: string): {
  id: string;
  name: string;
  placement: SocketPlacement;
} => {
  if (!ioKey) {
    return null;
  }
  const [name, id, placement] = ioKey.split('::');
  return {
    name,
    id,
    placement: placement as SocketPlacement,
  };
};
