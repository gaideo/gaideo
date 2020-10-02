import { MediaEntry } from "./media-entry";

export interface MediaFileEntry {
    mediaEntry: MediaEntry;
    indexFile: string
}

export enum MediaFileOperation {
    Add,
    Update,
    Delete,
    Share,
    Unshare
}