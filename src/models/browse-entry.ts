import { MediaEntry } from "./media-entry";

export interface BrowseEntry {
    mediaEntry: MediaEntry;
    previewImage?: string;
    source: string;
    age: string;
    previewImageHeight?: number;
    previewImageWidth?: number;
    actualHeight?: number;
    actualWidth?: number
}