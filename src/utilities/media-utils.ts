import { UserSession } from "blockstack";
import { BrowseEntry } from "../models/browse-entry";
import { UpdateProgressCallback } from "../models/callbacks";
import { FileOperation } from "../models/file-operation";
import { MediaEntry, MediaType } from "../models/media-entry";
import { updateMasterIndex, getShareRootInfo, getEncryptedFile, getPrivateKey } from "./data-utils";
import { base64ArrayBuffer } from "./encoding-utils";
import { computeAge } from "./time-utils";

export async function deleteVideoEntry(
    mediaEntry: MediaEntry,
    userSession: any,
    gaiaWorker: Worker | null,
    updateProgress: UpdateProgressCallback | undefined = undefined
) {
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
                    if (updateProgress) {
                        updateProgress(`Deleting video file: ${fileName}.`, null);
                    }
                    await userSession?.deleteFile(fileName, {
                        wasSigned: false
                    });
                }
                catch (error) {
                    console.log(error);
                }
            }
            if (previewFile) {
                if (updateProgress) {
                    updateProgress(`Deleting video file: ${previewFile}.`, null);
                }
                await userSession?.deleteFile(previewFile, {
                    wasSigned: false
                });
            }
            try {
                let keyFile = `videos/${mediaEntry.id}/private.key`;
                if (updateProgress) {
                    updateProgress(`Deleting video file: ${keyFile}.`, null);
                }
                await userSession?.deleteFile(keyFile)
            }
            catch { }

            let indexUrl: string = `videos/${mediaEntry.id}.index`;
            if (updateProgress) {
                updateProgress(`Deleting index file: ${indexUrl}.`, null);
            }
            await userSession?.deleteFile(indexUrl, {
                wasSigned: false
            });
            await updateMasterIndex(userSession, gaiaWorker, FileOperation.Delete, [{ indexFile: indexUrl, mediaEntry: mediaEntry }], undefined);
        }
        catch (ex) {
            console.log(`Unable to delete video: ${mediaEntry.id}`)
            console.log(ex);
        }
    }

}

export async function deleteImageEntry(
    mediaEntry: MediaEntry,
    userSession: UserSession,
    gaiaWorker: Worker | null,
    updateProgress: UpdateProgressCallback | undefined = undefined) {
    if (mediaEntry?.manifest?.length > 0) {
        for (let i = 0; i < mediaEntry.manifest.length; i++) {
            const entry = mediaEntry.manifest[i];
            const fileName = `images/${mediaEntry.id}/${entry}`;
            if (updateProgress) {
                updateProgress(`Deleting image file: ${fileName}`, null);
            }
            await userSession?.deleteFile(fileName, {
                wasSigned: false
            });
            try {
                let keyFile = `images/${mediaEntry.id}/private.key`;
                if (updateProgress) {
                    updateProgress(`Deleting private key: ${keyFile}`, null);
                }
                await userSession?.deleteFile(keyFile, {
                    wasSigned: false
                });
            }
            catch { }
        }

        let indexUrl: string = `images/${mediaEntry.id}.index`;
        if (updateProgress) {
            updateProgress(`Deleting index file: ${indexUrl}`, null);
        }
        await userSession?.deleteFile(indexUrl, {
            wasSigned: false
        });
        await updateMasterIndex(userSession, gaiaWorker, FileOperation.Delete, [{ indexFile: indexUrl, mediaEntry: mediaEntry }], undefined);
    }

}

export async function loadBrowseEntryFromCache(userSession: UserSession, mediaEntry: MediaEntry, loadPreviewImage: boolean): Promise<any> {
    let be: BrowseEntry | null = null;
    try {
        if (mediaEntry) {
            let source: string = '';
            if (mediaEntry.mediaType === MediaType.Video) {
                source = await userSession?.getFileUrl(`videos/${mediaEntry.id}/master.m3u8`, {
                    username: mediaEntry.userName
                });
            }
            if (source || mediaEntry.mediaType === MediaType.Images) {

                let content: string | ArrayBuffer | undefined;

                if (loadPreviewImage) {
                    let previewImageName = mediaEntry.previewImageName;
                    if (!previewImageName) {
                        if (mediaEntry.mediaType === MediaType.Images) {
                            previewImageName = `images/${mediaEntry.id}/${mediaEntry.manifest[0]}`;
                        }
                        else {
                            previewImageName = `videos/${mediaEntry.id}/${mediaEntry.id}_preview.jpg`;
                        }
                    }
                    content = await getEncryptedFile(userSession, previewImageName, mediaEntry.id, mediaEntry.mediaType === MediaType.Images ? MediaType.Images : MediaType.Video, mediaEntry.userName);
                }
                else {
                    content = undefined;
                }
                let userData = userSession.loadUserData();
                be = {
                    mediaEntry: mediaEntry,
                    previewImage: '',
                    source: source,
                    age: computeAge(mediaEntry.lastUpdatedUTC),
                    fromShare: (mediaEntry.userName && mediaEntry.userName !== userData.username) as boolean
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

export function getMediaIDFromIndexFileName(fileName: string) {
    let i = fileName.lastIndexOf('/');
    if (i >= 0) {
        return fileName.substring(i + 1).replace('.index', '');
    }
    return null;
}

export function getMediaTypeFromIndexFileName(fileName: string) {
    let ret = MediaType.Video;
    if (fileName.startsWith('images/')) {
        ret = MediaType.Images;
    }
    return ret;
}

export async function loadBrowseEntry(
    userSession: UserSession,
    indexFile: string,
    loadPreviewImage: boolean,
    userName?: string): Promise<any> {
    let be: BrowseEntry | null = null;
    try {
        let mediaID = getMediaIDFromIndexFileName(indexFile);
        let mediaType = getMediaTypeFromIndexFileName(indexFile);
        if (mediaID) {
            let userData = userSession.loadUserData();
            let mediaRootInfo = await getShareRootInfo(userData, true, userName);
            let privateKey = await getPrivateKey(mediaRootInfo.root, userSession, mediaID, mediaType, userName);
            if (privateKey) {
                let content = await userSession?.getFile(indexFile, {
                    decrypt: privateKey,
                    username: userName
                });
                if (content && typeof (content) === "string") {
                    let mediaEntry = JSON.parse(content);
                    be = await loadBrowseEntryFromCache(userSession, mediaEntry, loadPreviewImage);
                }
            }
        }
    }
    catch (error) {
        console.log(error);
    }
    return be;
}
