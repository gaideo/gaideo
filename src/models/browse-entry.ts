import { MediaEntry } from "./media-entry";

export interface BrowseEntry {
    mediaEntry: MediaEntry;
    previewImage?: string;
    source: string;
    age: string
}