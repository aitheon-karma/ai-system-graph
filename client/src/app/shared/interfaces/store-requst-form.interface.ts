export class FileItem {
  _id: string;
  size: number;
  createdAt?: string;
  filename: string;
  mimetype?: string;
  url?: string;
}

export class NodeStyling {
  _id: string;
  logo: FileItem;
  backgroundColor?: string;
  borderColor?: string;
}

export class SocketMetadata {
  _id?: string;
  name: string;
  multiple: boolean;
  socket: any;
  placement?: SocketMetadata.PlacementEnum;
}
export namespace SocketMetadata {
  export type PlacementEnum = 'LEFT' | 'CENTER' | 'RIGHT';
  export const PlacementEnum = {
    LEFT: 'LEFT' as PlacementEnum,
    CENTER: 'CENTER' as PlacementEnum,
    RIGHT: 'RIGHT' as PlacementEnum
  };
}

export class StoreRequestForm {
  createdBy?: string;
  type: StoreRequestForm.TypeEnum;
  project?: string;
  provisionalNode?: string;
  pricingType: StoreRequestForm.PricingTypeEnum;
  price: number;
  name: string;
  description: string;
  urlName: string;
  category: string;
  images: Array<FileItem>;
  titleImage: FileItem;
  nodeStyling?: NodeStyling;
  inputs: Array<SocketMetadata>;
  outputs: Array<SocketMetadata>;
  decision?: any;
}
export namespace StoreRequestForm {
  export type TypeEnum = 'PROVISIONAL' | 'PROJECT' | 'EMPTY';
  export const TypeEnum = {
    PROVISIONAL: 'PROVISIONAL' as TypeEnum,
    PROJECT: 'PROJECT' as TypeEnum,
    EMPTY: 'EMPTY' as TypeEnum
  };
  export type PricingTypeEnum = 'MONTHLY' | 'ONE_TIME';
  export const PricingTypeEnum = {
    MONTHLY: 'MONTHLY' as PricingTypeEnum,
    ONE_TIME: 'ONE_TIME' as PricingTypeEnum
  };
}
