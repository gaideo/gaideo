import { getPublicKeyFromPrivate, lookupProfile, makeECPrivateKey, publicKeyToAddress, UserSession } from "blockstack";
import { IDBPDatabase } from 'idb';
import { CacheEntry, CacheResults } from "../models/cache-entry";
import { UserData } from "blockstack/lib/auth/authApp";
import { ShareUserEntry } from "../models/share-user-entry";
import { FileRootInfo } from "../models/file-root-info";
import { Group } from "../models/group";
import { FileOperation } from "../models/file-operation";
import { FileEntry } from "../models/file-entry";
import { FileMetaData } from "../models/file-meta-data";



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

export async function getShareRootInfo(
    userData: UserData,
    isReading: boolean,
    userName?: string): Promise<FileRootInfo> {
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

export async function updateMasterIndex(
    userSession: UserSession,
    gaiaWorker: Worker | null,
    operation: FileOperation,
    fileEntries: FileEntry[],
    userName: string | undefined = undefined
) {
    try {
        if (userName
            && operation !== FileOperation.Share
            && operation !== FileOperation.Unshare
            && operation !== FileOperation.Update
            && operation !== FileOperation.Delete) {
            const msg = `Invalid operation for user name: ${userName}.  Only share and unshare operations are allowed`
            console.log(msg);
            throw Error(msg);
        }
        if (fileEntries?.length > 0) {
            let fileName = null;
            let publicFileName = null;
            let userData = userSession.loadUserData();
            let fileRootInfo = await getShareRootInfo(userData, false, userName);
            if (fileRootInfo.root.length > 0) {
                publicFileName = `${fileRootInfo.root}master-index`;
                fileName = `${fileRootInfo.root}internal-index`;
            }
            else {
                fileName = "master-index";
            }
            if (fileName) {
                let masterIndex = await getMasterIndex(userSession, fileName, operation !== FileOperation.Delete);
                if (masterIndex) {
                    let modified = false;
                    const privateLookup: any = {};
                    for (let i = 0; i < fileEntries.length; i++) {
                        let metaData = fileEntries[i].metaData;
                        if (operation === FileOperation.Delete
                            || operation === FileOperation.Unshare) {
                            if (masterIndex[fileEntries[i].indexFile]) {
                                delete masterIndex[fileEntries[i].indexFile];
                                modified = true;
                            }
                        }
                        else {
                            if (operation !== FileOperation.Update || masterIndex[fileEntries[i].indexFile]) {
                                masterIndex[fileEntries[i].indexFile] = fileEntries[i].metaData.lastUpdatedUTC;
                                modified = true;
                            }
                        }
                        if ((operation === FileOperation.Share
                            || operation === FileOperation.Unshare
                            || operation === FileOperation.Delete)
                            && modified && publicFileName) {
                            const sharePrivateKeyFile = getPrivateKeyFileName(fileRootInfo.root, metaData.id, metaData.type);
                            if (operation === FileOperation.Share) {
                                let privateKey = await getPrivateKey('', userSession, metaData.id, metaData.type);
                                if (privateKey) {
                                    let encryptedKey = await userSession.encryptContent(privateKey, {
                                        publicKey: fileRootInfo.publicKey
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
                        if (publicFileName && fileRootInfo.publicKey) {
                            for (let key in privateLookup) {
                                if (operation === FileOperation.Share) {
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
                                publicKey: fileRootInfo.publicKey
                            });
                            await userSession.putFile(publicFileName, encryptedJson, {
                                encrypt: false,
                                sign: false,
                                wasString: true
                            });
                        }
                        else if (operation === FileOperation.Delete || operation === FileOperation.Update) {
                            let shares = await getShares(userSession);
                            if (shares) {
                                for (let userName in shares) {
                                    await updateMasterIndex(userSession, null, operation, fileEntries, userName);
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
        if (operation === FileOperation.Delete) {
            fileEntries.forEach(x => {
                gaiaWorker.postMessage({
                    message: "removecache",
                    indexFile: x.indexFile
                })

            })

        }
        else if (operation === FileOperation.Update) {
            fileEntries.forEach(x => {
                gaiaWorker.postMessage({
                    message: "updatecache",
                    indexFile: x.indexFile
                });
            })
        }
        else if (operation === FileOperation.Add) {
            gaiaWorker.postMessage({
                message: "cacheindexes",
                indexFiles: fileEntries.map(x => x.indexFile)
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

export async function shareFile(mediaEntries: FileMetaData[], userSession: UserSession, shareUsers: ShareUserEntry[]) {
    const files: FileEntry[] = mediaEntries.map(x => {
        return {
            metaData: x,
            indexFile: `${x.type}/${x.id}.index`
        }
    });
    for (let i = 0; i < shareUsers.length; i++) {
        let su = shareUsers[i]
        let op = su.share ? FileOperation.Share : FileOperation.Unshare;
        await updateMasterIndex(userSession, null, op, files, su.userName);
    }
}

export function getFileIDFromIndexFileName(fileName: string) {
    let i = fileName.lastIndexOf('/');
    if (i >= 0) {
        return fileName.substring(i + 1).replace('.index', '');
    }
    return null;
}

export function getTypeFromIndexFileName(fileName: string) {
    let i = fileName.indexOf('/');
    if (i >= 0) {
        return fileName.substring(0, i);
    }
    return '';
}

export async function getCacheEntries(
    userSession: UserSession,
    db: IDBPDatabase<unknown>,
    type: string,
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
            && cursor.value.section === `${publicKey}_${type}`) {
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
    type: string) {
    let fileName = `${root}${type}/${id}/private.key`;
    return fileName;
}

export async function getPrivateKey(
    root: string,
    userSession: UserSession,
    id: string,
    type: string,
    userName?: string) {
    let privateKeyFile = getPrivateKeyFileName(root, id, type);
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

export async function getEncryptedFile(
    userSession: UserSession,
    fileName: string,
    id: string,
    type: string,
    owner: string | undefined = undefined) {
    let content: string | ArrayBuffer | undefined = undefined;
    let userData = userSession.loadUserData();
    let userName: string | undefined = undefined;
    if (userData.username !== owner) {
        userName = owner;
    }
    let mediaRootInfo = await getShareRootInfo(userData, true, userName);
    let privateKey = await getPrivateKey(mediaRootInfo.root, userSession, id, type, userName);
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

export async function createPrivateKey(
    userSession: UserSession,
    id: string,
    type: string) {
    let fileName = getPrivateKeyFileName('', id, type);
    let privateKey = makeECPrivateKey();
    await userSession.putFile(fileName, privateKey, {
        encrypt: true,
        wasString: true,
        sign: true
    })
    return privateKey;
}

export async function getSelectedShares(userSession: UserSession) {
    let selectedShares: string[] = []
    let missingFile = false;
    try {
        let json = await userSession.getFile('selected-shares', {
            decrypt: true,
            verify: true,
        }) as string;
        if (json) {
            selectedShares = JSON.parse(json);
        }
    }
    catch {
        missingFile = true;
    }
    if (missingFile) {
        try {
            await saveSelectedShares(userSession, []);
        }
        catch {

        }
    }
    if (selectedShares.length === 0) {
        return null;
    }
    return selectedShares;
}

export async function saveSelectedShares(userSession: UserSession, selectedShares: string[]) {
    try {
        await userSession.putFile('selected-shares', JSON.stringify(selectedShares), {
            encrypt: true,
            sign: true
        })
    }
    catch (error) {
        console.log(error);
    }
}

export function getShareNames(selectedShares: Array<any> | null | undefined) {
    let shareNames: string[] | undefined = undefined;
    if (selectedShares) {
        const arr: string[] = [];
        selectedShares.forEach(x => {
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

export async function getShares(userSession: UserSession | null | undefined) {
    let shares: any = {};
    try {
        let json = await userSession?.getFile("share-index", {
            decrypt: true,
            verify: true
        }) as string;
        if (json) {
            shares = JSON.parse(json);
        }
    }
    catch {

    }
    return shares;
}

export async function updateShares(userSession: UserSession, userNames: string[], deleteFlag: boolean = false) {
    let shares = await getShares(userSession);
    if (userNames.length > 0) {
        for (let i = 0; i < userNames.length; i++) {
            let userName = userNames[i];
            if (deleteFlag) {
                delete shares[userName.toLowerCase()];
            }
            else {
                shares[userName.toLowerCase()] = userName;
            }
        }
    }
    await userSession.putFile("share-index", JSON.stringify(shares), {
        encrypt: true,
        wasString: true,
        sign: true
    });
}

export async function updateGroup(userSession: UserSession, group: Group, deleteFlag: boolean = false) {
    let groups = await getGroups(userSession);
    if (groups) {
        if (deleteFlag) {
            delete groups[group.id];
        }
        else {
            groups[group.id] = group;
        }
    }
    await userSession.putFile("group-index", JSON.stringify(groups), {
        encrypt: true,
        wasString: true,
        sign: true
    });
}

export async function getGroups(userSession: UserSession | null | undefined) {
    let groups: any = {};
    try {
        let json = await userSession?.getFile("group-index", {
            decrypt: true,
            verify: true
        }) as string;
        if (json) {
            groups = JSON.parse(json);
        }
    }
    catch {

    }
    return groups;
}

export async function getSelectedGroup(userSession: UserSession) {
    let selectedGroup: string | null = null;
    let missingFile = false;
    try {
        let text = await userSession.getFile('selected-group', {
            decrypt: true,
            verify: true,
        }) as string;
        if (text && text.length > 0) {
            selectedGroup = text;
        }
    }
    catch {
        missingFile = true;
    }
    if (missingFile) {
        try {
            await saveSelectedGroup(userSession, null);
        }
        catch {

        }
    }
    return selectedGroup;
}

export async function saveSelectedGroup(userSession: UserSession, selectedGroup: string | null) {
    try {
        await userSession.putFile('selected-group', selectedGroup ? selectedGroup : '', {
            encrypt: true,
            sign: true
        })
    }
    catch (error) {
        console.log(error);
    }
}

export async function getGroup(userSession: UserSession, id: string) {
    let group: Group | null = null;
    try {
        let json = await userSession.getFile('group-index', {
            decrypt: true,
            verify: true,
        }) as string;
        if (json && json.length > 0) {
            let map = JSON.parse(json) as any;
            if (map) {
                group = map[id];
            }
        }
    }
    catch {
    }
    return group;
}
