import { BrowseEntry } from "./browse-entry";
import { Photo } from "./photo";


export interface VideosLoadedCallback {
    (videos: BrowseEntry[]): void
}

export interface ImagesLoadedCallback {
    (photos: Photo[]): void
}

