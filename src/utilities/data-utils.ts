import { MediaEntry, MediaType } from "../models/media-entry";
import { getPublicKeyFromPrivate, lookupProfile, makeECPrivateKey, publicKeyToAddress, UserSession } from "blockstack";
import { BrowseEntry } from "../models/browse-entry";
import { base64ArrayBuffer } from "./encoding-utils";
import { computeAge } from "./time-utils";
import { IDBPDatabase } from 'idb';
import { CacheEntry, CacheResults } from "../models/cache-entry";
import { getAddressFromPublicKey } from "@blockstack/stacks-transactions";
import { MediaFileEntry } from "../models/media-file-entry";
import { UserData } from "blockstack/lib/auth/authApp";


export async function deleteVideoEntry(mediaEntry: MediaEntry, userSession: any, worker: Worker | null) {
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
            try {
                await userSession?.deleteFile(`videos/${mediaEntry.id}/private.key`)
            }
            catch { }

            let indexUrl: string = `videos/${mediaEntry.id}.index`;
            await userSession?.deleteFile(indexUrl, {
                wasSigned: false
            });
            await updateMasterIndex(userSession, [{ indexFile: indexUrl, mediaEntry: mediaEntry }], undefined, true);
            worker?.postMessage({
                message: "removecache",
                indexFile: indexUrl
            })

        }
        catch (ex) {
            console.log(`Unable to delete video: ${mediaEntry.id}`)
            console.log(ex);
        }
    }

}

export async function getPublicKey(userName: string) {
    let profile = await lookupProfile(userName);
    if (profile) {
        let appMeta = profile.appsMeta[document.location.origin];
        if (appMeta) {
            return appMeta.publicKey;
        }
    }
    return null;
}

export function createHashAddress(values: string[]) {
    let value = values.join('_');
    var idBuffer = new TextEncoder().encode(value) as Buffer;
    let ret = publicKeyToAddress(idBuffer);
    return ret;

}

export function getUserDirectory(publicKey: string) {
    let addr = getAddressFromPublicKey(publicKey);
    return `share/${addr}/`;
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

export function getRootDirectory(publicKey: string, userData: UserData) {
    let ret = '';
    let currentPublicKey = getPublicKeyFromPrivate(userData.appPrivateKey);
    if (currentPublicKey !== publicKey) {
        ret = getUserDirectory(publicKey);
    }
    return ret;
}

export async function updateMasterIndex(
    userSession: UserSession,
    mediaFileEntries: MediaFileEntry[],
    userName: string | undefined = undefined,
    deleteFlag: boolean = false) {
    try {
        if (mediaFileEntries?.length > 0) {
            let fileName = null;
            let publicFileName = null;
            let userData = userSession.loadUserData();
            let publicKey = getPublicKeyFromPrivate(userData.appPrivateKey);
            if (userName && userName.length > 0) {
                publicKey = await getPublicKey(userName);
            }
            let userDir = await getRootDirectory(publicKey, userData);
            if (userDir && userDir.length > 0) {
                publicFileName = `${userDir}master-index`;
                fileName = `${userDir}internal-index`;
            }
            else {
                fileName = "master-index";
            }
            if (fileName) {
                let masterIndex = await getMasterIndex(userSession, fileName, !deleteFlag);
                if (masterIndex) {
                    for (let i = 0; i < mediaFileEntries.length; i++) {
                        if (deleteFlag) {
                            delete masterIndex[mediaFileEntries[i].indexFile];
                        }
                        else {
                            masterIndex[mediaFileEntries[i].indexFile] = mediaFileEntries[i].mediaEntry.lastUpdatedUTC
                        }
                    }
                    await userSession.putFile(fileName, JSON.stringify(masterIndex), {
                        encrypt: true,
                        sign: true,
                        wasString: true
                    });
                    if (publicFileName && publicKey) {
                        let json = JSON.stringify(masterIndex);
                        let encryptedJson = await userSession.encryptContent(json, {
                            publicKey: publicKey
                        });
                        await userSession.putFile(publicFileName, encryptedJson, {
                            encrypt: false,
                            sign: false,
                            wasString: true
                        });
                    }
                }
            }
        }
    }
    catch {

    }
}

export async function deleteImageEntry(mediaEntry: MediaEntry, userSession: any, worker: Worker | null) {
    if (mediaEntry?.manifest?.length > 0) {
        for (let i = 0; i < mediaEntry.manifest.length; i++) {
            let entry = mediaEntry.manifest[i];
            await userSession?.deleteFile(`images/${mediaEntry.id}/${entry}`, {
                wasSigned: false
            });
            try {
                await userSession?.deleteFile(`images/${mediaEntry.id}/private.key`, {
                    wasSigned: false
                });
            }
            catch { }
        }

        let indexUrl: string = `images/${mediaEntry.id}.index`;
        await userSession?.deleteFile(indexUrl, {
            wasSigned: false
        });
        await updateMasterIndex(userSession, [{ indexFile: indexUrl, mediaEntry: mediaEntry }], undefined, true);
        worker?.postMessage({
            message: "removecache",
            indexFile: indexUrl
        })
    }

}

export async function getCacheEntries(
    userSession: UserSession,
    db: IDBPDatabase<unknown>,
    mediaType: MediaType,
    max: number | null,
    lastCacheKeys: IDBValidKey[] | null): Promise<CacheResults> {
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
    while (cursor) {
        if (cursor.value.data
            && cursor.value.section === `${publicKey}_${mediaType === MediaType.Images ? 1 : 0}`) {
            cacheEntries.push({
                data: cursor.value.data,
                section: cursor.value.section,
                key: cursor.key,
                primaryKey: cursor.primaryKey,
                lastUpdated: cursor.value.lastUpdated
            });
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

export async function getPrivateKeyFileName(
    userData: UserData,
    id: string,
    mediaType: MediaType,
    userName: string | undefined = undefined) {
    let publicKey = getPublicKeyFromPrivate(userData.appPrivateKey);
    if (userName) {
        publicKey = await getPublicKey(userName);
        if (!publicKey) {
            throw new Error(`Unable to locate user: ${userName}.`);
        }
    }
    let root = getRootDirectory(publicKey, userData);
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

export async function getPrivateKey(userSession: UserSession, userData: UserData, id: string, mediaType: MediaType, userName: string | undefined = undefined) {
    let privateKeyFile = await getPrivateKeyFileName(userData, id, mediaType, userName);
    let privateKey: string | null | undefined;
    try {
        privateKey = await userSession.getFile(privateKeyFile, {
            decrypt: true,
            verify: true,
            username: userName
        }) as string;
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
    let privateKey = await getPrivateKey(userSession, userData, id, mediaType, userName);
    if (privateKey) {
        let encryptedContent = await userSession.getFile(fileName, {
            decrypt: false
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
                source = await userSession?.getFileUrl(`videos/${mediaEntry.id}/master.m3u8`);
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
                be = {
                    mediaEntry: mediaEntry,
                    previewImage: '',
                    source: source,
                    age: computeAge(mediaEntry.lastUpdatedUTC)
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


export async function loadBrowseEntry(userSession: UserSession, indexFile: string, loadPreviewImage: boolean, mediaType: MediaType): Promise<any> {
    let be: BrowseEntry | null = null;
    try {
        let content = await userSession?.getFile(indexFile, {
            decrypt: true,
            verify: true
        });
        if (content && typeof (content) === "string") {
            let mediaEntry = JSON.parse(content);
            be = await loadBrowseEntryFromCache(userSession, mediaEntry, loadPreviewImage);
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
    let userData = userSession.loadUserData();
    let fileName = await getPrivateKeyFileName(userData, id, mediaType);
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