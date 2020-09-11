import { VideoEntry } from "../models/video-entry";
import { UserSession } from "blockstack";
import { BrowseEntry } from "../models/browse-entry";
import { base64ArrayBuffer } from "./encoding-utils";
import { getNow, getTimeAge } from "./time-utils";


export async function deleteVideoEntry(videoEntry: VideoEntry, userSession: any) {
    if (videoEntry?.manifest?.length > 0) {
        for (let i=0; i<videoEntry.manifest.length; i++) {
            let entry = videoEntry.manifest[i];
            await userSession?.deleteFile(`videos/${videoEntry.id}/${entry}`, {
                wasSigned: false
            });
        }
        let indexUrl: string = `videos/${videoEntry.id}.index`;
        await userSession?.deleteFile(indexUrl, {
            wasSigned: false
        });
    }

}

export async function loadBrowseEntry(userSession: UserSession, indexFile: string, loadPreviewImage: boolean) : Promise<any> {
    let be: BrowseEntry | null = null;
    let content = await userSession?.getFile(indexFile, {
        decrypt: true,
        verify: true
    });
    if (content && typeof (content) === "string") {
        let videoEntry = JSON.parse(content);
        let source = await userSession?.getFileUrl(`videos/${videoEntry.id}/master.m3u8`);
        if (source) {

            let content: string | ArrayBuffer | undefined;

            if (loadPreviewImage) {
                content = await userSession?.getFile(`videos/${videoEntry.id}/${videoEntry.id}_preview.jpg`, {
                    decrypt: true,
                })
            }
            else {
                content = undefined;
            }
            let cd: Date;
            if (!videoEntry.createdDateUTC) {
                cd = getNow();
            }
            else {
                cd = new Date(videoEntry.createdDateUTC);
            }
            let now = getNow();
            let age = getTimeAge(cd, now);
            be = {
                videoEntry: videoEntry,
                previewImage: '',
                source: source,
                age: age
            };
            let buffer = content as ArrayBuffer;
            if (!loadPreviewImage || buffer) {
                const base64 = base64ArrayBuffer(buffer);
                if (be) {
                    be.previewImage = base64;
                }
            }
        }
    }
    return be;
}
