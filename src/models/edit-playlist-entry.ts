import { GroupEntry } from "./group";

export interface EditPlaylistEntry extends GroupEntry {
    type: string,
    title: string
}