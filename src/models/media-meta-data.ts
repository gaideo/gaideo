import { FileMetaData as FileMetaData } from "./file-meta-data";

export interface MediaMetaData extends FileMetaData {
    previewImageName?: string;
}
