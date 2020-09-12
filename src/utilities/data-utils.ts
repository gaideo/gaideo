import { MediaEntry, MediaType } from "../models/media-entry";
import { UserSession } from "blockstack";
import { BrowseEntry } from "../models/browse-entry";
import { base64ArrayBuffer } from "./encoding-utils";
import { getNow, getTimeAge } from "./time-utils";


export async function deleteVideoEntry(mediaEntry: MediaEntry, userSession: any) {
    if (mediaEntry?.manifest?.length > 0) {
        try {
            let previewFile: string | null = null;
            for (let i = 0; i < mediaEntry.manifest.length; i++) {
                let entry = mediaEntry.manifest[i];
                let fileName = `videos/${mediaEntry.id}/${entry}`;
                if (entry.endsWith('_preview.jpg')) {
                    previewFile = fileName;
                    continue;
                }
                try {
                    await userSession?.deleteFile(fileName, {
                        wasSigned: false
                    });
                }
                catch (error) {
                    console.log(error);
                }
            }
            if (previewFile) {
                await userSession?.deleteFile(previewFile, {
                    wasSigned: false
                });
            }
            let indexUrl: string = `videos/${mediaEntry.id}.index`;
            await userSession?.deleteFile(indexUrl, {
                wasSigned: false
            });
        }
        catch (ex) {
            console.log(`Unable to delete video: ${mediaEntry.id}`)
            console.log(ex);
        }
    }

}

export async function deleteImageEntry(mediaEntry: MediaEntry, userSession: any) {
    const regexImageDir = getImageDirRegex();
    if (mediaEntry?.manifest?.length > 0) {
        for (let i = 0; i < mediaEntry.manifest.length; i++) {
            let entry = mediaEntry.manifest[i];
            let dir = regexImageDir.exec(mediaEntry.id);
            await userSession?.deleteFile(`images/${dir}/${entry}`, {
                wasSigned: false
            });
        }

        let indexUrl: string = `images/${mediaEntry.id}.index`;
        await userSession?.deleteFile(indexUrl, {
            wasSigned: false
        });
    }

}

function getImageDirRegex() {
    return /^[0-9A-Za-z]+-[0-9A-Za-z]+-[0-9A-Za-z]+-[0-9A-Za-z]+-[0-9A-Za-z]+/g;
}
export async function loadBrowseEntry(userSession: UserSession, indexFile: string, loadPreviewImage: boolean, mediaType: MediaType): Promise<any> {
    const regexImageDir = getImageDirRegex();
    let be: BrowseEntry | null = null;
    try {
        let content = await userSession?.getFile(indexFile, {
            decrypt: true,
            verify: true
        });
        if (content && typeof (content) === "string") {
            let mediaEntry = JSON.parse(content);
            let source: string = '';
            if (mediaType === MediaType.Video) {
                source = await userSession?.getFileUrl(`videos/${mediaEntry.id}/master.m3u8`);
            }
            if (source || mediaType === MediaType.Images) {

                let content: string | ArrayBuffer | undefined;

                if (loadPreviewImage) {
                    let previewImageName = mediaEntry.previewImageName;
                    if (!previewImageName) {
                        if (mediaType === MediaType.Images) {
                            let dir = regexImageDir.exec(mediaEntry.id);
                            previewImageName = `images/${dir}/${mediaEntry.manifest[0]}`;
                        }
                        else {
                            previewImageName = `videos/${mediaEntry.id}/${mediaEntry.id}_preview.jpg`;
                        }
                    }
                    content = await userSession?.getFile(previewImageName, {
                        decrypt: true,
                    })
                }
                else {
                    content = undefined;
                }
                let cd: Date;
                if (!mediaEntry.createdDateUTC) {
                    cd = getNow();
                }
                else {
                    cd = new Date(mediaEntry.createdDateUTC);
                }
                let now = getNow();
                let age = getTimeAge(cd, now);
                be = {
                    mediaEntry: mediaEntry,
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
    }
    catch (error) {
        console.log(error);
    }
    return be;
}
