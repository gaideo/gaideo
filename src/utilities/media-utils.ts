import { UserSession } from "blockstack";
import { BrowseEntry } from "../models/browse-entry";
import { ImagesLoadedCallback, UpdateProgressCallback, VideosLoadedCallback } from "../models/callbacks";
import { FileOperation } from "../models/file-operation";
import { MediaMetaData } from "../models/media-meta-data";
import { updateMasterIndex, getShareRootInfo, getEncryptedFile, getPrivateKey, getFileIDFromIndexFileName, getTypeFromIndexFileName, getCacheEntriesFromGroup, getTypeFromSection } from "./gaia-utils";
import { base64ArrayBuffer } from "./encoding-utils";
import { computeAge, sleep } from "./time-utils";
import { CacheEntry } from "../models/cache-entry";
import { getImageSize } from "./image-utils";
import { Photo } from "../models/photo";
import { IDBPDatabase } from "idb";
import { EditPlaylistEntry } from "../models/edit-playlist-entry";

export const ImagesType = "images";
export const VideosType = "videos";
export const MusicType = "music";
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
                let fileName = `${metaData.type}/${metaData.id}/${entry}`;
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
            if (!metaData.isPublic) {
                try {
                    let keyFile = `${metaData.type}/${metaData.id}/private.key`;
                    if (updateProgress) {
                        updateProgress(`Deleting video file: ${keyFile}.`, null);
                    }
                    await userSession?.deleteFile(keyFile)
                }
                catch { }
            }

            let indexUrl: string = `${metaData.type}/${metaData.id}.index`;
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
            const fileName = `${metaData.type}/${metaData.id}/${entry}`;
            if (updateProgress) {
                updateProgress(`Deleting image file: ${fileName}`, null);
            }
            await userSession?.deleteFile(fileName, {
                wasSigned: false
            });
            if (!metaData.isPublic) {
                try {
                    let keyFile = `${metaData.type}/${metaData.id}/private.key`;
                    if (updateProgress) {
                        updateProgress(`Deleting private key: ${keyFile}`, null);
                    }
                    await userSession?.deleteFile(keyFile, {
                        wasSigned: false
                    });
                }
                catch { }
            }
        }

        let indexUrl: string = `${metaData.type}/${metaData.id}.index`;
        if (updateProgress) {
            updateProgress(`Deleting index file: ${indexUrl}`, null);
        }
        await userSession?.deleteFile(indexUrl, {
            wasSigned: false
        });
        await updateMasterIndex(userSession, gaiaWorker, FileOperation.Delete, [{ indexFile: indexUrl, metaData: metaData }], undefined);
    }

}

export async function getPlaylistEntries(userSession: UserSession, db: IDBPDatabase<unknown>, playlistId: string, type: string | null) {
    const arr = new Array<EditPlaylistEntry>();
    let results = await getCacheEntriesFromGroup(userSession, db, type, null, playlistId, null, null);
    if (results && results.allEntries && results.allEntries.length > 0) {
        let ud = userSession.loadUserData();
        for (let i = 0; i < results.allEntries.length; i++) {
            const cacheEntry = results.allEntries[i];
            let decryptedData: string | null = null;
            try {
                decryptedData = await userSession.decryptContent(cacheEntry.data) as string;
            }
            catch (error) {
                console.log(error);
            }
            if (decryptedData) {
                let metaData = JSON.parse(decryptedData);
                let entryType = getTypeFromSection(cacheEntry.section);
                let username = metaData.userName;
                let title = metaData.title;
                if (username && username !== ud.username) {
                    title = `${title} (${username})`;
                }
                const entry: EditPlaylistEntry = {
                    type: entryType,
                    groupid: playlistId,
                    indexFile: `${entryType}/${metaData.id}.index`,
                    userName: username,
                    title: title
                };
                arr.push(entry);
            }
        }
    }
    return arr;
}

export async function loadBrowseEntryFromCache(userSession: UserSession, metaData: MediaMetaData, loadPreviewImage: boolean): Promise<any> {
    let be: BrowseEntry | null = null;
    try {
        if (metaData) {
            let source: string = '';
            if (metaData.type === VideosType || metaData.type === MusicType) {
                source = await userSession?.getFileUrl(`${metaData.type}/${metaData.id}/master.m3u8`, {
                    username: metaData.userName
                });
            }
            if (source || metaData.type === ImagesType) {

                let isMusic = metaData.type === MusicType;
                let content: string | ArrayBuffer | null;

                if (loadPreviewImage && !isMusic) {
                    let previewImageName = metaData.previewImageName;
                    if (!previewImageName) {
                        if (metaData.type === ImagesType) {
                            previewImageName = `${metaData.type}/${metaData.id}/${metaData.manifest[0]}`;
                        }
                        else {
                            previewImageName = `${metaData.type}/${metaData.id}/${metaData.id}_preview.jpg`;
                        }
                    }
                    const isPublic = metaData.isPublic ? true : false;
                    content = await getEncryptedFile(userSession, previewImageName, metaData.id, metaData.type, isPublic, metaData.userName);
                }
                else {
                    content = null;
                }
                let userData = userSession.loadUserData();

                let buffer = content as ArrayBuffer;
                if (isMusic || !loadPreviewImage || buffer) {
                    be = {
                        metaData: metaData,
                        previewImage: '',
                        source: source,
                        age: computeAge(metaData.lastUpdatedUTC),
                        fromShare: (metaData.userName && metaData.userName !== userData.username) as boolean
                    };
                    if (isMusic) {
                        be.previewImage = metaData.previewImageName;
                    }
                    else {
                        const base64 = base64ArrayBuffer(buffer);
                        if (be) {
                            be.previewImage = base64;
                        }
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
            let content = await userSession?.getFile(indexFile, {
                decrypt: false,
                username: userName
            }) as string;
            let metaData = JSON.parse(content);
            if (metaData.iv) {
                let privateKey = await getPrivateKey(mediaRootInfo.root, userSession, mediaID, mediaType, userName);
                if (privateKey) {
                    content = await userSession.decryptContent(content, {
                        privateKey: privateKey
                    }) as string;
                    metaData = JSON.parse(content);
                }
                else {
                    metaData = null;
                }
            }
            if (metaData) {
                be = await loadBrowseEntryFromCache(userSession, metaData, loadPreviewImage);
            }
        }
    }
    catch (error) {
        console.log(error);
    }
    return be;
}

export async function loadBatchVideos(userSession: UserSession,
    startIndex: number,
    cacheEntries: CacheEntry[],
    allVideos: BrowseEntry[],
    batchSize: number,
    videosLoadedCallback: VideosLoadedCallback) {
    if (userSession?.isUserSignedIn()
        && startIndex >= 0
        && startIndex < cacheEntries.length) {
        let loadingCount = 0;
        let arr: BrowseEntry[] = [];
        for (let i = startIndex; (i - startIndex) < batchSize && i < cacheEntries.length; i++) {
            let decryptedData: string | null = null;
            try {
                decryptedData = await userSession.decryptContent(cacheEntries[i].data) as string;
            }
            catch (error) {
                console.log(error);
            }
            if (decryptedData) {
                let metaData = JSON.parse(decryptedData);
                let be = await loadBrowseEntryFromCache(userSession, metaData, true) as BrowseEntry;
                if (be) {
                    let img = new Image();
                    let src;
                    if (be.previewImage !== 'music.png') {
                        src = `data:image/png;base64, ${be.previewImage}`;
                    }
                    else {
                        src = be.previewImage;
                    }
                    loadingCount++;
                    img.onload = ev => {
                        const size = getImageSize(img.width, img.height, 400, 200);
                        be.previewImageWidth = size[0];
                        be.previewImageHeight = size[1];
                        be.actualHeight = img.height;
                        be.actualWidth = img.width;
                        arr.push(be);
                    };
                    img.src = src;

                }
            }
        }
        while (loadingCount !== arr.length) {
            await sleep(300);
        }
        arr.forEach(x => {
            allVideos.push(x);
        });
        videosLoadedCallback(allVideos.slice())
    }
}

export function gcd(a: number, b: number): number {
    if (b === 0)
        return a
    return gcd(b, a % b);
}

export function loadPhoto(be: BrowseEntry, img: HTMLImageElement, src: string) {
    var r = gcd(img.width, img.height,);
    let aspectWidth = img.width / r;
    let aspectHeight = img.height / r;
    let photo: Photo = {
        browseEntry: be,
        width: aspectWidth,
        height: aspectHeight,
        title: be.metaData.title,
        src: src,
        selected: false,
        aspectWidth: aspectWidth,
        aspectHeight: aspectHeight
    }
    return photo;
}

export async function loadBatchImages(userSession: UserSession,
    startIndex: number,
    cacheEntries: CacheEntry[],
    allPhotos: Photo[],
    batchSize: number,
    imagesLoadedCallback: ImagesLoadedCallback) {
    if (userSession?.isUserSignedIn()
        && startIndex >= 0
        && startIndex < cacheEntries.length) {
        let loadingCount = 0;
        let arr: Photo[] = [];
        for (let i = startIndex; (i - startIndex) < batchSize && i < cacheEntries.length; i++) {
            let decryptedData = await userSession.decryptContent(cacheEntries[i].data) as string;
            if (decryptedData) {
                let metaData = JSON.parse(decryptedData);
                let be = await loadBrowseEntryFromCache(userSession, metaData, true) as BrowseEntry
                if (be) {
                    let img = new Image();
                    let src = `data:image/png;base64, ${be.previewImage}`;
                    loadingCount++;
                    img.onload = ev => {
                        let photo = loadPhoto(be, img, src);
                        arr.push(photo)
                    };
                    img.src = src;
                }
            }
        }
        while (loadingCount !== arr.length) {
            await sleep(300);
        }
        arr.forEach(x => {
            allPhotos.push(x);
        });
        imagesLoadedCallback(allPhotos.slice())
    }
}
