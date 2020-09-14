import { BrowseEntry } from "./browse-entry";

export interface Photo {
    src: string,
    width: number,
    height: number,
    title?: string,
    browseEntry: BrowseEntry,
    selected: boolean,
    aspectHeight: number,
    aspectWidth: number
}
