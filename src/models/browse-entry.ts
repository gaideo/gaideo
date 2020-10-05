import { MediaMetaData } from "./media-meta-data";

export interface BrowseEntry {
    metaData: MediaMetaData;
    previewImage?: string;
    source: string;
    age: string;
    fromShare: boolean;
    previewImageHeight?: number;
    previewImageWidth?: number;
    actualHeight?: number;
    actualWidth?: number
}