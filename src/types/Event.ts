export enum EventType {
  UPLOAD,
  DELETE,
  DOWNLOAD,
}

// Discriminated union type
interface BaseProcessItem {
  id: string;
  eventType: EventType;
}

export interface TextProcessItem extends BaseProcessItem {
  type: "text";
  value: string;
}

export interface FileProcessItem extends BaseProcessItem {
  type: "file";
  value: File;
  extension: string;
  localPath?: string;
  docPath?: string;
}

export interface DeleteProcessItem extends BaseProcessItem {
  type: "text";
  fileLink: string;
  fileKey: string;
  originalSelection: string;
}

export interface DownloadProcessItem extends BaseProcessItem {
  type: "download";
  url: string;
}

export type ProcessItem =
  | TextProcessItem
  | FileProcessItem
  | DeleteProcessItem
  | DownloadProcessItem;
