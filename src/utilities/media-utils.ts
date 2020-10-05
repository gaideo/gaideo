import { UserSession } from "blockstack";
import { BrowseEntry } from "../models/browse-entry";
import { UpdateProgressCallback } from "../models/callbacks";
import { FileOperation } from "../models/file-operation";
import { MediaMetaData } from "../models/media-meta-data";
import { updateMasterIndex, getShareRootInfo, getEncryptedFile, getPrivateKey, getFileIDFromIndexFileName, getTypeFromIndexFileName } from "./gaia-utils";
import { base64ArrayBuffer } from "./encoding-utils";
import { computeAge } from "./time-utils";

export const ImagesType = "images";
export const VideosType = "videos";
export const UnencryptedVideosType = "unencryptedvideo";

export async function deleteVideoEntry(
    metaData: MediaMetaData,
    userSession: any,
    gaiaWorker: Worker | null,
    updateProgress: UpdateProgressCallback | undefined = undefined
) {
    if (metaData?.manifest?.length > 0) {
        try {
            let previewFile: string | null = null;
            for (let i = 0; i < metaData.manifest.length; i++) {
                let entry = metaData.manifest[i];
                let fileName = `videos/${metaData.id}/${entry}`;
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
                let keyFile = `videos/${metaData.id}/private.key`;
                if (updateProgress) {
                    updateProgress(`Deleting video file: ${keyFile}.`, null);
                }
                await userSession?.deleteFile(keyFile)
            }
            catch { }

            let indexUrl: string = `videos/${metaData.id}.index`;
            if (updateProgress) {
                updateProgress(`Deleting index file: ${indexUrl}.`, null);
            }
            await userSession?.deleteFile(indexUrl, {
                wasSigned: false
            });
            await updateMasterIndex(userSession, gaiaWorker, FileOperation.Delete, [{ indexFile: indexUrl, metaData: metaData }], undefined);
        }
        catch (ex) {
            console.log(`Unable to delete video: ${metaData.id}`)
            console.log(ex);
        }
    }

}

export async function deleteImageEntry(
    metaData: MediaMetaData,
    userSession: UserSession,
    gaiaWorker: Worker | null,
    updateProgress: UpdateProgressCallback | undefined = undefined) {
    if (metaData?.manifest?.length > 0) {
        for (let i = 0; i < metaData.manifest.length; i++) {
            const entry = metaData.manifest[i];
            const fileName = `images/${metaData.id}/${entry}`;
            if (updateProgress) {
                updateProgress(`Deleting image file: ${fileName}`, null);
            }
            await userSession?.deleteFile(fileName, {
                wasSigned: false
            });
            try {
                let keyFile = `images/${metaData.id}/private.key`;
                if (updateProgress) {
                    updateProgress(`Deleting private key: ${keyFile}`, null);
                }
                await userSession?.deleteFile(keyFile, {
                    wasSigned: false
                });
            }
            catch { }
        }

        let indexUrl: string = `images/${metaData.id}.index`;
        if (updateProgress) {
            updateProgress(`Deleting index file: ${indexUrl}`, null);
        }
        await userSession?.deleteFile(indexUrl, {
            wasSigned: false
        });
        await updateMasterIndex(userSession, gaiaWorker, FileOperation.Delete, [{ indexFile: indexUrl, metaData: metaData }], undefined);
    }

}

export async function loadBrowseEntryFromCache(userSession: UserSession, metaData: MediaMetaData, loadPreviewImage: boolean): Promise<any> {
    let be: BrowseEntry | null = null;
    try {
        if (metaData) {
            let source: string = '';
            if (metaData.type === VideosType) {
                source = await userSession?.getFileUrl(`videos/${metaData.id}/master.m3u8`, {
                    username: metaData.userName
                });
            }
            if (source || metaData.type === ImagesType) {

                let content: string | ArrayBuffer | undefined;

                if (loadPreviewImage) {
                    let previewImageName = metaData.previewImageName;
                    if (!previewImageName) {
                        if (metaData.type === ImagesType) {
                            previewImageName = `images/${metaData.id}/${metaData.manifest[0]}`;
                        }
                        else {
                            previewImageName = `videos/${metaData.id}/${metaData.id}_preview.jpg`;
                        }
                    }
                    content = await getEncryptedFile(userSession, previewImageName, metaData.id, metaData.type, metaData.userName);
                }
                else {
                    content = undefined;
                }
                let userData = userSession.loadUserData();
                be = {
                    metaData: metaData,
                    previewImage: '',
                    source: source,
                    age: computeAge(metaData.lastUpdatedUTC),
                    fromShare: (metaData.userName && metaData.userName !== userData.username) as boolean
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

export async function loadBrowseEntry(
    userSession: UserSession,
    indexFile: string,
    loadPreviewImage: boolean,
    userName?: string): Promise<any> {
    let be: BrowseEntry | null = null;
    try {
        let mediaID = getFileIDFromIndexFileName(indexFile);
        let mediaType = getTypeFromIndexFileName(indexFile);
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
                    let metaData = JSON.parse(content);
                    be = await loadBrowseEntryFromCache(userSession, metaData, loadPreviewImage);
                }
            }
        }
    }
    catch (error) {
        console.log(error);
    }
    return be;
}
