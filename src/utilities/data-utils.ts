import { MediaEntry, MediaType } from "../models/media-entry";
import { getPublicKeyFromPrivate, lookupProfile, makeECPrivateKey, publicKeyToAddress, UserSession } from "blockstack";
import { BrowseEntry } from "../models/browse-entry";
import { base64ArrayBuffer } from "./encoding-utils";
import { computeAge } from "./time-utils";
import { IDBPDatabase } from 'idb';
import { CacheEntry, CacheResults } from "../models/cache-entry";
import { MediaFileEntry, MediaFileOperation } from "../models/media-file-entry";
import { UserData } from "blockstack/lib/auth/authApp";
import { ShareUserEntry } from "../models/share-user-entry";
import { UpdateProgressCallback } from "../models/callbacks";
import { MediaRootInfo } from "../models/media-root-info";


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
            await updateMasterIndex(userSession, gaiaWorker, MediaFileOperation.Delete, [{ indexFile: indexUrl, mediaEntry: mediaEntry }], undefined);
        }
        catch (ex) {
            console.log(`Unable to delete video: ${mediaEntry.id}`)
            console.log(ex);
        }
    }

}

export async function getPublicKey(userData: UserData, userName: string | null | undefined) {
    let publicKey;
    if (userName) {
        let profile = await lookupProfile(userName);
        if (profile) {
            let appMeta = profile.appsMeta[document.location.origin];
            if (appMeta) {
                return appMeta.publicKey;
            }
        }
    }
    else {
        publicKey = getPublicKeyFromPrivate(userData.appPrivateKey);
        return publicKey
    }
    throw new Error(`Unable to locate user: ${userName}.`);
}

export function createHashAddress(values: string[]) {
    let value = values.join('_');
    var idBuffer = new TextEncoder().encode(value) as Buffer;
    let ret = publicKeyToAddress(idBuffer);
    return ret;

}

const getMasterIndex = async (userSession: UserSession, fileName: string, canCreate: boolean) => {
    let ret = null;
    try {
        let json = await userSession.getFile(fileName, {
            decrypt: true,
            verify: true
        }) as string;
        if (json) {
            ret = JSON.parse(json);
        }
    }
    catch {
        if (canCreate) {
            ret = {};
        }
    }
    return ret;
}

export function getUserDirectory(publicKey: string) {
    let addr = publicKeyToAddress(publicKey);
    return `share/${addr}/`;
}

export async function getMediaRootInfo(
    userData: UserData,
    isReading: boolean,
    userName?: string): Promise<MediaRootInfo> {
    let ret = '';
    let publicKey;
    if (userName) {
        if (isReading) {
            publicKey = getPublicKeyFromPrivate(userData.appPrivateKey);
        }
        else {
            publicKey = await getPublicKey(userData, userName)
        }
        ret = getUserDirectory(publicKey);
    }
    else {
        publicKey = getPublicKeyFromPrivate(userData.appPrivateKey);
    }
    return {
        root: ret,
        publicKey: publicKey
    };
}
export async function getSelectedFriends(userSession: UserSession) {
    let selectedFriends: string[] = []
    let missingFile = false;
    try {
        let json = await userSession.getFile('selected-friends', {
            decrypt: true,
            verify: true,
        }) as string;
        if (json) {
            selectedFriends = JSON.parse(json);
        }
    }
    catch {
        missingFile = true;
    }
    if (missingFile) {
        try {
            await saveSelectedFriends(userSession, []);
        }
        catch {

        }
    }
    if (selectedFriends.length === 0) {
        return null;
    }
    return selectedFriends;
}

export async function saveSelectedFriends(userSession: UserSession, selectedFriends: string[]) {
    try {
        await userSession.putFile('selected-friends', JSON.stringify(selectedFriends), {
            encrypt: true,
            sign: true
        })
    }
    catch (error) {
        console.log(error);
    }
}

export async function updateMasterIndex(
    userSession: UserSession,
    gaiaWorker: Worker | null,
    operation: MediaFileOperation,
    mediaFileEntries: MediaFileEntry[],
    userName: string | undefined = undefined
) {
    try {
        if (userName
            && operation !== MediaFileOperation.Share
            && operation !== MediaFileOperation.Unshare
            && operation !== MediaFileOperation.Update
            && operation !== MediaFileOperation.Delete) {
            const msg = `Invalid operation for user name: ${userName}.  Only share and unshare operations are allowed`
            console.log(msg);
            throw Error(msg);
        }
        if (mediaFileEntries?.length > 0) {
            let fileName = null;
            let publicFileName = null;
            let userData = userSession.loadUserData();
            let mediaRootInfo = await getMediaRootInfo(userData, false, userName);
            if (mediaRootInfo.root.length > 0) {
                publicFileName = `${mediaRootInfo.root}master-index`;
                fileName = `${mediaRootInfo.root}internal-index`;
            }
            else {
                fileName = "master-index";
            }
            if (fileName) {
                let masterIndex = await getMasterIndex(userSession, fileName, operation !== MediaFileOperation.Delete);
                if (masterIndex) {
                    let modified = false;
                    const privateLookup: any = {};
                    for (let i = 0; i < mediaFileEntries.length; i++) {
                        let mediaEntry = mediaFileEntries[i].mediaEntry;
                        if (operation === MediaFileOperation.Delete
                            || operation === MediaFileOperation.Unshare) {
                            if (masterIndex[mediaFileEntries[i].indexFile]) {
                                delete masterIndex[mediaFileEntries[i].indexFile];
                                modified = true;
                            }
                        }
                        else {
                            if (operation !== MediaFileOperation.Update || masterIndex[mediaFileEntries[i].indexFile]) {
                                masterIndex[mediaFileEntries[i].indexFile] = mediaFileEntries[i].mediaEntry.lastUpdatedUTC;
                                modified = true;
                            }
                        }
                        if ((operation === MediaFileOperation.Share
                            || operation === MediaFileOperation.Unshare
                            || operation === MediaFileOperation.Delete)
                            && modified && publicFileName) {
                            const mt = mediaEntry.mediaType ? MediaType.Images : MediaType.Video;
                            const sharePrivateKeyFile = getPrivateKeyFileName(mediaRootInfo.root, mediaEntry.id, mt);
                            if (operation === MediaFileOperation.Share) {
                                let privateKey = await getPrivateKey('', userSession, mediaEntry.id, mt);
                                if (privateKey) {
                                    let encryptedKey = await userSession.encryptContent(privateKey, {
                                        publicKey: mediaRootInfo.publicKey
                                    })
                                    privateLookup[sharePrivateKeyFile] = encryptedKey;
                                }
                                else {
                                    const msg = `Unable to get private key for sharing.`;
                                    console.log(msg);
                                    throw new Error(msg);
                                }
                            }
                            else {
                                privateLookup[sharePrivateKeyFile] = null;
                            }
                        }
                    }
                    if (modified) {
                        await userSession.putFile(fileName, JSON.stringify(masterIndex), {
                            encrypt: true,
                            sign: true,
                            wasString: true
                        });
                        if (publicFileName && mediaRootInfo.publicKey) {
                            for (let key in privateLookup) {
                                if (operation === MediaFileOperation.Share) {
                                    userSession.putFile(key, privateLookup[key], {
                                        encrypt: false,
                                        sign: false,
                                        wasString: true
                                    });
                                }
                                else {
                                    userSession.deleteFile(key);
                                }
                            }
                            let json = JSON.stringify(masterIndex);
                            let encryptedJson = await userSession.encryptContent(json, {
                                publicKey: mediaRootInfo.publicKey
                            });
                            await userSession.putFile(publicFileName, encryptedJson, {
                                encrypt: false,
                                sign: false,
                                wasString: true
                            });
                        }
                        else if (operation === MediaFileOperation.Delete || operation === MediaFileOperation.Update) {
                            let friends = await getFriends(userSession);
                            if (friends) {
                                for (let userName in friends) {
                                    await updateMasterIndex(userSession, null, operation, mediaFileEntries, userName);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    catch {

    }
    if (gaiaWorker) {
        if (operation === MediaFileOperation.Delete) {
            mediaFileEntries.forEach(x => {
                gaiaWorker.postMessage({
                    message: "removecache",
                    indexFile: x.indexFile
                })

            })

        }
        else if (operation === MediaFileOperation.Update) {
            mediaFileEntries.forEach(x => {
                gaiaWorker.postMessage({
                    message: "updatecache",
                    indexFile: x.indexFile
                });
            })
        }
        else if (operation === MediaFileOperation.Add) {
            gaiaWorker.postMessage({
                message: "cacheindexes",
                indexFiles: mediaFileEntries.map(x => x.indexFile)
            });
        }
    }
}

export async function listFiles(userSession: UserSession) {
    await userSession.listFiles(name => {
        console.log(name);
        return true;
    })
}

export async function shareMedia(mediaEntries: MediaEntry[], userSession: UserSession, shareUsers: ShareUserEntry[]) {
    const mediaFiles: MediaFileEntry[] = mediaEntries.map(x => {
        return {
            mediaEntry: x,
            indexFile: `${x.mediaType === MediaType.Images ? 'images' : 'videos'}/${x.id}.index`
        }
    });
    for (let i = 0; i < shareUsers.length; i++) {
        let su = shareUsers[i]
        let op = su.share ? MediaFileOperation.Share : MediaFileOperation.Unshare;
        updateMasterIndex(userSession, null, op, mediaFiles, su.userName);
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
        await updateMasterIndex(userSession, gaiaWorker, MediaFileOperation.Delete, [{ indexFile: indexUrl, mediaEntry: mediaEntry }], undefined);
    }

}

export async function getCacheEntries(
    userSession: UserSession,
    db: IDBPDatabase<unknown>,
    mediaType: MediaType,
    max: number | null,
    lastCacheKeys: IDBValidKey[] | null,
    shareNames?: string[] | null | undefined): Promise<CacheResults> {
    let ud = userSession.loadUserData();
    let publicKey = getPublicKeyFromPrivate(ud.appPrivateKey);
    let cursor = await db.transaction('cached-indexes').store.index('lastUpdated').openCursor(undefined, "prev");
    if (cursor && lastCacheKeys && lastCacheKeys.length > 0) {
        cursor = await cursor.continuePrimaryKey(lastCacheKeys[0], lastCacheKeys[1])
    }
    let count = 0;
    let cacheEntries: CacheEntry[] = [];
    let nextKey: IDBValidKey | null = null;
    let nextPrimaryKey: IDBValidKey | null = null;
    let shareLookup: any = {};
    if (shareNames && shareNames.length > 0) {
        shareNames.forEach(x => {
            shareLookup[x.toLowerCase()] = true;
        })
    }
    while (cursor) {
        if (cursor.value.data
            && cursor.value.section === `${publicKey}_${mediaType === MediaType.Images ? 1 : 0}`) {
            let canAdd = true;
            let shareName = cursor.value.shareName;
            if (!shareNames && shareName) {
                canAdd = false;
            }
            else if (shareNames && (!shareName || !shareLookup[shareName])) {
                canAdd = false;
            }
            if (canAdd) {
                cacheEntries.push({
                    data: cursor.value.data,
                    section: cursor.value.section,
                    key: cursor.key,
                    primaryKey: cursor.primaryKey,
                    lastUpdated: cursor.value.lastUpdated
                });
            }
            count++;
            if (max != null && count >= max) {
                cursor = await cursor.continue();
                if (cursor) {
                    nextKey = cursor.key;
                    nextPrimaryKey = cursor.primaryKey;
                }
                break;
            }
        }
        cursor = await cursor.continue();
    }
    return {
        cacheEntries: cacheEntries,
        nextKey: nextKey,
        nextPrimaryKey: nextPrimaryKey
    };
}

export function getPrivateKeyFileName(
    root: string,
    id: string,
    mediaType: MediaType) {
    let mediaDir;
    if (mediaType === MediaType.Images) {
        mediaDir = 'images/'
    }
    else {
        mediaDir = 'videos/'
    }
    let fileName = `${root}${mediaDir}${id}/private.key`;
    return fileName;
}

export async function getPrivateKey(
    root: string,
    userSession: UserSession,
    id: string,
    mediaType: MediaType,
    userName?: string) {
    let privateKeyFile = getPrivateKeyFileName(root, id, mediaType);
    let privateKey: string | null | undefined;
    try {
        if (userName) {
            const encryptedJson = await userSession.getFile(privateKeyFile, {
                decrypt: false,
                verify: false,
                username: userName
            }) as string;
            privateKey = await userSession.decryptContent(encryptedJson) as string;
        }
        else {
            privateKey = await userSession.getFile(privateKeyFile, {
                decrypt: true,
                verify: true,
                username: userName
            }) as string;
        }
    }
    catch {

    }
    return privateKey;
}

export async function getEncryptedMediaFile(
    userSession: UserSession,
    fileName: string,
    id: string,
    mediaType: MediaType,
    owner: string | undefined = undefined) {
    let content: string | ArrayBuffer | undefined = undefined;
    let userData = userSession.loadUserData();
    let userName: string | undefined = undefined;
    if (userData.username !== owner) {
        userName = owner;
    }
    let mediaRootInfo = await getMediaRootInfo(userData, true, userName);
    let privateKey = await getPrivateKey(mediaRootInfo.root, userSession, id, mediaType, userName);
    if (privateKey) {
        let encryptedContent = await userSession.getFile(fileName, {
            decrypt: false,
            username: userName
        }) as string;
        if (encryptedContent) {
            content = await userSession.decryptContent(encryptedContent, {
                privateKey: privateKey
            });
        }
    }
    if (!content) {
        content = await userSession.getFile(fileName);
    }
    return content;
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
                    content = await getEncryptedMediaFile(userSession, previewImageName, mediaEntry.id, mediaEntry.mediaType === MediaType.Images ? MediaType.Images : MediaType.Video, mediaEntry.userName);
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

export function getShareNames(selectedFriends: Array<any> | null | undefined) {
    let shareNames: string[] | undefined = undefined;
    if (selectedFriends) {
        const arr: string[] = [];
        selectedFriends.forEach(x => {
            if (x?.value) {
                arr.push(x.value);
            }
        })
        if (arr.length > 0) {
            shareNames = arr;
        }
    }
    return shareNames;
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
            let mediaRootInfo = await getMediaRootInfo(userData, true, userName);
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

export async function createPrivateKey(
    userSession: UserSession,
    id: string,
    mediaType: MediaType) {
    let fileName = getPrivateKeyFileName('', id, mediaType);
    let privateKey = makeECPrivateKey();
    await userSession.putFile(fileName, privateKey, {
        encrypt: true,
        wasString: true,
        sign: true
    })
    return privateKey;
}

export async function getFriends(userSession: UserSession | null | undefined) {
    let friends: any = {};
    try {
        let json = await userSession?.getFile("friends", {
            decrypt: true,
            verify: true
        }) as string;
        if (json) {
            friends = JSON.parse(json);
        }
    }
    catch {

    }
    return friends;
}

export async function updateFriends(userSession: UserSession, userNames: string[], deleteFlag: boolean = false) {
    let friends = await getFriends(userSession);
    if (userNames.length > 0) {
        for (let i = 0; i < userNames.length; i++) {
            let userName = userNames[i];
            if (deleteFlag) {
                delete friends[userName.toLowerCase()];
            }
            else {
                friends[userName.toLowerCase()] = userName;
            }
        }
    }
    await userSession.putFile("friends", JSON.stringify(friends), {
        encrypt: true,
        wasString: true,
        sign: true
    });
}