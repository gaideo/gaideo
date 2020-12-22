import { FileMetaData } from "./file-meta-data";

export interface FileEntry {
    id: string;
    type: string;
    lastUpdatedUTC?: Date;
    isPublic?: boolean
}
