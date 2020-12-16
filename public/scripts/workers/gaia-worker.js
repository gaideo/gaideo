
importScripts("/scripts/blockstack/blockstack.js", "/scripts/idb/index-min.js", "/scripts/js-search/porter-stemmer.js", "/scripts/js-search/js-search.min.js");

const getSearchTokens = (text, minRelevant) => {
    const tokenizer = new JsSearch.StopWordsTokenizer(new JsSearch.SimpleTokenizer());
    const tokens = tokenizer.tokenize(text);
    const ret = [];
    tokens.forEach(x => {
        if (x.length >= minRelevant) {
            ret.push(stemmer(x.toLowerCase()));
        }
    })
    return ret;
}

const initializeDatabase = async () => {
    let ret = true;
    if (!self.db) {
        self.db = await idb.openDB('gaideodb', 2, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (!oldVersion || oldVersion < 2) {
                    ret = false;
                }
            },
            blocked() {
                ret = false;
            },
            blocking() {
            },
            terminated() {
            },
        });
    }
    return ret;
}

const createMasterIndex = async () => {
    let masterIndex = {};
    await userSession.listFiles(name => {
        let foundMediaFile = false;
        if (fileTypes) {
            for (let i=0; i<fileTypes.length; i++) {
                if (name.startsWith(`${fileTypes[i]}/`)) {
                    foundMediaFile = true;
                    break;
                }
            }
        }
        if (foundMediaFile && name.endsWith('.index')) {
            masterIndex[name] = null;
        }
        return true;
    });
    try {
        await userSession.putFile('master-index', JSON.stringify(masterIndex), {
            encrypt: true,
            wasString: true,
            sign: true,
            dangerouslyIgnoreEtag: true
        });
    } catch {
        await userSession.deleteFile('master-index');
        await userSession.putFile('master-index', JSON.stringify(masterIndex), {
            encrypt: true,
            wasString: true,
            sign: true,
            dangerouslyIgnoreEtag: true
        });
    }
    return masterIndex;
}

const getMasterIndex = async (root, userName, isPublic) => {
    let masterIndex = null;
    try {
        let fileName = 'master-index';
        if (root) {
            fileName = `${root}${fileName}`;
        }
        let json;
        if (userName) {
            json = await userSession.getFile(fileName, {
                decrypt: false,
                verify: false,
                username: userName
            });
            if (!isPublic) {
                json = await userSession.decryptContent(json);
            }
        }
        else {
            json = await userSession.getFile(fileName, {
                decrypt: true,
                verify: true,
                username: userName
            });
        }
        if (json) {
            masterIndex = JSON.parse(json);
        }
    }
    catch {
    }
    return masterIndex;
}

const createIndexID = async (publicKey, index, userName) => {
    let idStr = `${publicKey}_${index}`;
    if (userName) {
        idStr = `${idStr}_${userName}`;
    }
    var idBuffer = new TextEncoder().encode(idStr);
    let id = blockstack.publicKeyToAddress(idBuffer);
    return id;
}

const getPublicKey = async (userName) => {
    let publicKey;
    if (userName) {
        let profile = await blockstack.lookupProfile(userName);
        if (profile) {
            let appMeta = profile.appsMeta[location.origin];
            if (appMeta) {
                return appMeta.publicKey;
            }
        }
    }
    else {
        publicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);
        return publicKey
    }
    throw new Error(`Unable to locate user: ${userName}.`);
}

const getUserDirectory = (publicKey) => {
    let addr = blockstack.publicKeyToAddress(publicKey);
    return `share/${addr}/`;
}

const getPrivateKeyFileName = (
    publicKey,
    id,
    type,
    userName) => {
    let root = '';
    if (userName) {
        root = getUserDirectory(publicKey);
    }
    let fileName = `${root}${type}/${id}/private.key`;
    return fileName;
}

const getPrivateKey = async (
    userSession,
    id,
    type,
    userName) => {
    let publicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);
    let privateKeyFile = getPrivateKeyFileName(publicKey, id, type, userName);
    let privateKey;
    try {
        if (userName) {
            const encryptedJson = await userSession.getFile(privateKeyFile, {
                decrypt: false,
                verify: false,
                username: userName
            });
            privateKey = await userSession.decryptContent(encryptedJson);
        }
        else {
            privateKey = await userSession.getFile(privateKeyFile, {
                decrypt: true,
                verify: true
            });
        }
    }
    catch {

    }
    return privateKey;
}

const removeCachedIndex = async (indexFile, pk) => {
    let publicKey = null;
    if (pk) {
        publicKey = pk;
    }
    else if (sessionData?.userData?.appPrivateKey) {
        publicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);
    }
    if (publicKey) {
        let id = await createIndexID(publicKey, indexFile);
        await db.delete('cached-indexes', id);
        return true;

    }
    return false;
}

const getIDFromIndexFileName = (fileName) => {
    let i = fileName?.lastIndexOf('/');
    if (i >= 0) {
        return fileName.substring(i + 1).replace('.index', '');
    }
    return null;
}

const getTypeFromIndexFileName = (fileName) => {
    let i = fileName.indexOf('/');
    if (i >= 0) {
        return fileName.substring(0, i);
    }
    return '';
}

const updateCachedIndex = async (indexFile, pk) => {
    let ownerPublicKey = null;
    if (pk) {
        ownerPublicKey = pk;
    }
    else if (sessionData?.userData?.appPrivateKey) {
        ownerPublicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);
    }
    if (ownerPublicKey) {
        let indexID = await createIndexID(ownerPublicKey, indexFile);
        let id = getIDFromIndexFileName(indexFile);
        let type = getTypeFromIndexFileName(indexFile);
        if (id) {
            let json = await userSession.getFile(indexFile, {
                decrypt: false
            });
            let metaData = JSON.parse(json);
            if (metaData.iv) {
                let privateKey = await getPrivateKey(userSession, id, type);
                json = await userSession.decryptContent(json, { privateKey: privateKey })
                metaData = JSON.parse(json);
            }
            let encryptedJson = await userSession.encryptContent(json);
            let cachedIndex = {
                data: encryptedJson,
                id: indexID,
                section: `${ownerPublicKey}_${metaData.type}`,
                lastUpdated: metaData.lastUpdatedUTC
            }
            await db.put('cached-indexes', cachedIndex);
            await updateSearchHashes(indexID, metaData, true);
            return true;
        }
    }
    return false;
}

const addIndexesToCache = async (indexFiles) => {
    if (sessionData?.userData?.appPrivateKey) {
        publicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);
        for (let i = 0; i < indexFiles.length; i++) {
            let indexFile = indexFiles[i];
            await updateCachedIndex(indexFile, publicKey);
        }
        return true;
    }
    return false;
}

const udpateSearchHashesForText = async (cacheid, text, type) => {
    const maxHashLength = 9;
    const minRelevant = 3;
    const tokens = getSearchTokens(text, minRelevant);
    for (let i = 0; i < tokens?.length; i++) {
        const t = tokens[i];
        for (let j = minRelevant - 1; j < t.length; j++) {
            let idBuffer;
            if (j < maxHashLength) {
                const x = `${type}_${t.substring(0, j + 1)}`;
                idBuffer = new TextEncoder().encode(x);
            }
            else {
                break;
            }
            const hashToken = blockstack.publicKeyToAddress(idBuffer);
            idBuffer = new TextEncoder().encode(`${cacheid}_${hashToken}`);
            const searchHashId = blockstack.publicKeyToAddress(idBuffer);
            let searchEntry = {
                id: searchHashId,
                hashid: hashToken,
                cacheid: cacheid
            };
            await db.put('searchable-hashes', searchEntry);
        }
    }
}

const updateSearchHashes = async (cacheid, metaData, isUpdate) => {
    if (isUpdate) {
        const deleteKeys = [];
        let cursor = await db.transaction('searchable-hashes').store.index('cacheid').openCursor(IDBKeyRange.only(cacheid));
        while (cursor) {
            deleteKeys.push(cursor.primaryKey);
            cursor = await cursor.continue();
        }
        for (let i = 0; i < deleteKeys.length; i++) {
            await db.delete('searchable-hashes', deleteKeys[i]);
        }
    }
    await udpateSearchHashesForText(cacheid, metaData.title, metaData.type);
    if (metaData.keywords && metaData.keywords.length > 0) {
        for (let i = 0; i < metaData.keywords.length; i++) {
            await udpateSearchHashesForText(cacheid, metaData.keywords[i], metaData.type);
        }
    }
}

const saveGaiaIndexesToCache = async (userName, isPublic) => {
    let newCounts = {};
    try {
        let ownerPublicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);;
        let root = '';
        if (userName) {
            if (!isPublic) {
                root = getUserDirectory(ownerPublicKey);
            }
            else {
                root = `share/public/`
            }
        }
        let masterIndex = await getMasterIndex(root, userName, isPublic);
        if (masterIndex) {
            existingCache = {};
            const index = db.transaction('cached-indexes').store.index('section');
            if (index) {
                for (let i = 0; i < fileTypes?.length; i++) {
                    let cursor = await index.openCursor(`${ownerPublicKey}_${fileTypes[i]}`);
                    while (cursor) {
                        let canAdd = true;
                        if (!userName && cursor.value.shareName) {
                            canAdd = false;
                        }
                        else if (userName
                            && (!cursor.value.shareName || userName.toLowerCase() !== cursor.value.shareName.toLowerCase())) {
                            canAdd = false;
                        }
                        else if (cursor.value.isPublic && !isPublic) {
                            canAdd = false;
                        }
                        else if (!cursor.value.isPublic && isPublic) {
                            canAdd = false;
                        }
                        if (canAdd) {
                            existingCache[cursor.value.id] = cursor.value.lastUpdated;
                        }
                        cursor = await cursor.continue();
                    }
                }
            }
            let latestUpdated = null;
            existing = {};
            missing = [];
            for (let indexFile in masterIndex) {
                try {
                    let indexID = await createIndexID(ownerPublicKey, indexFile, userName);
                    existing[indexID] = true;
                    let lastUpdated = masterIndex[indexFile];
                    let lastProcessed = existingCache[indexID];
                    if (!lastProcessed || (lastUpdated && lastUpdated > lastProcessed)) {
                        let id = getIDFromIndexFileName(indexFile);
                        if (id) {
                            let type = getTypeFromIndexFileName(indexFile);
                            let json = await userSession.getFile(indexFile, {
                                decrypt: false,
                                username: userName
                            });
                            let metaData = JSON.parse(json);
                            if (metaData.iv) {
                                let privateKey = await getPrivateKey(userSession, id, type, userName);
                                json = await userSession.decryptContent(json, { privateKey: privateKey });
                                metaData = JSON.parse(json);
                            }

                            // old format skip
                            if (metaData.mediaType !== null && metaData.mediaType !== undefined) {
                                continue;
                            }

                            if (!latestUpdated || latestUpdated < metaData.lastUpdatedUTC) {
                                latestUpdated = metaData.lastUpdatedUTC;
                            }
                            let encryptedJson = await userSession.encryptContent(json);
                            let cachedIndex = {
                                data: encryptedJson,
                                id: indexID,
                                section: `${ownerPublicKey}_${metaData.type}`,
                                lastUpdated: metaData.lastUpdatedUTC,
                                shareName: userName,
                                isPublic: isPublic
                            }
                            await db.put('cached-indexes', cachedIndex);
                            await updateSearchHashes(indexID, metaData, lastProcessed ? true : false);
                            if (newCounts[metaData.type] > 0) {
                                const count = newCounts[metaData.type];
                                newCounts[metaData.type] = count + 1;
                            }
                            else {
                                newCounts[metaData.type] = 1;
                            }
                        }
                    }
                }
                catch (metaDataError) {
                    missing.push(indexFile)
                    console.log(metaDataError);
                }
            }
            if (!userName && missing.length > 0) {
                missing.forEach(x => {
                    delete masterIndex[x];
                })
                await userSession.putFile("master-index", JSON.stringify(masterIndex), {
                    encrypt: !isPublic,
                    wasString: true,
                    sign: !isPublic
                })
            }
            for (let key in existingCache) {
                if (!existing[key]) {
                    await db.delete('cached-indexes', key);
                }
            }
        }
    }
    catch (error) {
        console.log(error);
    }
    if (userName && !isPublic) {
        let counts = await saveGaiaIndexesToCache(userName, true);
        if (counts) {
            for (type in counts) {
                if (counts[type] > 0) {
                    if (newCounts[type] > 0) {
                        const count = newCounts[type];
                        newCounts[type] = count + counts[type];
                    }
                    else {
                        newCounts[type] = counts[type];
                    }
                }
            }
        }
    }
    return newCounts;
}

const initializeUserSession = (e) => {
    if (!self.userSession || !self.userSession.isUserSignedIn()) {
        self.fileTypes = e.data.fileTypes;
        let sessionData = JSON.parse(e.data.sessionData);
        let appConfig = new self.blockstack.AppConfig(['store_write'], e.data.location)
        self.userSession = new self.blockstack.UserSession({
            appConfig: appConfig,
            sessionOptions: sessionData
        });
        self.sessionData = sessionData;
        self.origin = e.data.origin;
        self.location = e.data.location;
    }
}

const getShares = async () => {
    let shares = {};
    try {
        let json = await userSession?.getFile("share-index", {
            decrypt: true,
            verify: true
        });
        if (json) {
            shares = JSON.parse(json);
        }
    }
    catch {

    }
    return shares;
}

const getGroupIndex = async (userSession, id) => {
    let groupIndex = {}
    try {
        let json = await userSession.getFile(`groups/${id}.index`, {
            decrypt: true,
            verify: true
        });
        if (json) {
            groupIndex = JSON.parse(json);
        }
    }
    catch {

    }
    return groupIndex;
}

const validateGroupEntries = async (e) => {
    if (e && e.data.groupid && e.data.missing && e.data.missing.length > 0) {
        let groupIndex = await getGroupIndex(userSession, e.data.groupid);
        if (groupIndex) {
            let saveFlag = false;
            for (let i = 0; i < e.data.missing.length; i++) {
                let x = e.data.missing[i];
                let found = true;
                try {
                    await userSession.getFile(x.indexFile, {
                        decrypt: false,
                        verify: false,
                        username: x.userName
                    })
                }
                catch {
                    found = false;
                }
                if (!found && groupIndex[x.indexFile]) {
                    delete groupIndex[x.indexFile];
                    saveFlag = true;
                }
            }
            if (saveFlag) {
                try {
                    await userSession.putFile(`groups/${e.data.groupid}.index`, JSON.stringify(groupIndex), {
                        encrypt: true,
                        sign: true
                    });
                }
                catch (error) {
                    console.log(error);
                }
            }
        }
    }
}

self.addEventListener(
    "message",
    async function (e) {
        let message;
        switch (e.data.message) {
            case "load":
                try {
                    await initializeDatabase();
                    initializeUserSession(e);
                    if (userSession?.isUserSignedIn()) {
                        try {
                            await userSession.getFile('master-index', {
                                decrypt: true,
                                verify: true
                            });
                        }
                        catch {
                            await createMasterIndex();
                        }
                        let newCounts = await saveGaiaIndexesToCache();
                        if (!newCounts) {
                            newCounts = {};
                        }
                        let shares = await getShares();
                        for (key in shares) {
                            shareCounts = await saveGaiaIndexesToCache(key);
                            if (shareCounts) {
                                for (type in shareCounts) {
                                    if (shareCounts[type] > 0) {
                                        if (newCounts[type] > 0) {
                                            const count = newCounts[type];
                                            newCounts[type] = count + shareCounts[type];
                                        }
                                        else {
                                            newCounts[type] = shareCounts[type];
                                        }
                                    }
                                }
                            }
                        }
                        postMessage({
                            message: 'loadcomplete',
                            result: true,
                            newCounts: newCounts
                        });
                    }
                    else {
                        postMessage({
                            message: 'Unable to load data because userSession is not signed in.',
                            result: false
                        })
                    }

                }
                catch (error) {
                    postMessage({
                        message: error,
                        result: false
                    });
                }

                break;
            case "cacheindexes":
                message = 'Unable to add index to cache.';
                if (userSession?.isUserSignedIn()
                    && e.data.indexFiles?.length > 0) {
                    try {
                        if (await addIndexesToCache(e.data.indexFiles)) {
                            message = null;
                        }
                    }
                    catch (error) {
                        message = error;
                    }
                }
                if (message) {
                    postMessage({
                        message: message,
                        result: false
                    })
                }
                else {
                    postMessage({
                        message: "cacheindexescomplete",
                        result: true
                    })
                }
                break;
            case "removecache":
                message = 'Unable to delete cached index.';
                if (userSession?.isUserSignedIn()
                    && e.data.indexFile?.length > 0) {
                    try {
                        if (await removeCachedIndex(e.data.indexFile)) {
                            message = null;
                        }
                    }
                    catch (error) {
                        message = error;
                    }
                }
                if (message) {
                    postMessage({
                        message: message,
                        result: false
                    })
                }
                else {
                    postMessage({
                        message: "removecachecomplete",
                        result: true
                    })
                }
                break;
            case "updatecache":
                message = 'Unable to update cached index.';
                if (userSession?.isUserSignedIn()
                    && e.data.indexFile?.length > 0) {
                    try {
                        if (await updateCachedIndex(e.data.indexFile)) {
                            message = null;
                        }
                    }
                    catch (error) {
                        message = error;
                    }
                }
                if (message) {
                    postMessage({
                        message: message,
                        result: false
                    })
                }
                else {
                    postMessage({
                        message: "updatecachecomplete",
                        result: true
                    })
                }
                break;
            case "deletedb":
                db?.close();
                await idb.deleteDB("gaideodb", {
                    blocked() {
                        console.log("Unable to delete cached indexes database because all connections could not be closed.")
                    }
                });
                try {
                    await userSession.deleteFile('master-index');
                }
                catch { }

                postMessage({
                    message: "deletedbcomplete",
                    result: true
                })
                break;
            case "validate-group-entries":
                await validateGroupEntries(e);
                postMessage({
                    message: "validate-group-entries-complete",
                    result: true
                })
                break;
            default:
                postMessage({
                    message: 'unknown',
                    result: false
                });
                break;
        }
    },
    false
);

postMessage({
    message: "ready",
    result: true
})