export enum EventType {
  UPLOAD,
  DELETE,
  DOWNLOAD,
}

export interface DeleteItem {
  fileLink: string;
  fileKey: string;
  originalSelection: string;
}

// 可辨识联合类型
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
}

export interface DeleteProcessItem extends BaseProcessItem {
  type: "text";
  fileLink: string;
  fileKey: string;
  originalSelection: string;
}

export type ProcessItem = TextProcessItem | FileProcessItem | DeleteProcessItem;
