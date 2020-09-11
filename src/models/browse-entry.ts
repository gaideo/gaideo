import { VideoEntry } from "./video-entry";

export interface BrowseEntry {
    videoEntry: VideoEntry;
    previewImage?: string;
    source: string;
    age: string
}