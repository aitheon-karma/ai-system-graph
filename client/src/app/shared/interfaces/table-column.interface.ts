export interface TableColumn {
  title?: string;
  flex?: number;
  key?: string;
  uom?: string;
  label?: string;
  formatter?: (value: any) => void;
  callback?: (value: any, event: Event) => void;
  disableSort?: boolean;
  checkMark?: boolean;
}
