
export enum EventType {
  UPLOAD,
  DELETE,
  DOWNLOAD,
}

export interface ProcessFile extends DataTransferItem {
  id: string;
  eventType: EventType;
  extension?: string;
  localPath?: string;
}


export interface ProcessItem<T = string | File> {
  id: string;
  eventType: EventType;
  type: string;
  value: T;
  extension?: string;
  localPath?: string;
}

export interface DeleteItem {
  fileLink: string;
  fileKey: string;
  originalSelection: string;
}
