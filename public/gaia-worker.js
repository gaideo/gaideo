
importScripts("/scripts/blockstack/blockstack.js", "/scripts/idb/index-min.js");


self.addEventListener(
    "message",
    async function (e) {
        const initializeUserSession = () => {
            if (!self.userSession || !self.userSession.isUserSignedIn()) {
                self.mediaTypes = [0, 1];
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
        const initializeDatabase = async () => {
            let ret = true;
            if (!self.db) {
                self.db = await idb.openDB('gaideodb', 1, {
                    upgrade(db, oldVersion, newVersion, transaction) {
                        if (!oldVersion || oldVersion < 1) {
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
                if ((name.startsWith("videos/") || name.startsWith("images/"))
                    && name.endsWith('.index')) {
                    masterIndex[name] = null;
                }
                return true;
            });
            try {
                await userSession.putFile('master-index', JSON.stringify(masterIndex), {
                    encrypt: true,
                    wasString: true,
                    sign: true,
                });
            } catch {
                await userSession.deleteFile('master-index');
                await userSession.putFile('master-index', JSON.stringify(masterIndex), {
                    encrypt: true,
                    wasString: true,
                    sign: true,
                });
            }
            return masterIndex;
        }

        const getMasterIndex = async (root, userName) => {
            let masterIndex = null;
            try {
                let fileName = 'master-index';
                if (root) {
                    fileName = `${root}${fileName}`;
                }
                let json;
                json = await userSession.getFile(fileName, {
                    decrypt: true,
                    verify: true,
                    username: userName
                });
                if (json) {
                    masterIndex = JSON.parse(json);
                }
            }
            catch {
            }
            return masterIndex;
        }

        const createIndexID = async (publicKey, index) => {
            let idStr = `${publicKey}_${index}`;
            var idBuffer = new TextEncoder().encode(idStr);
            let id = blockstack.publicKeyToAddress(idBuffer);
            return id;
        }

        const getUserDirectory = (publicKey) => {
            let addr = blockstack.getAddressFromPublicKey(publicKey);
            return `share/${addr}/`;
        }

        const updateCachedIndex = async (indexFile, pk) => {
            let publicKey = null;
            if (pk) {
                publicKey = pk;
            }
            else if (sessionData?.userData?.appPrivateKey) {
                publicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);
            }
            if (publicKey) {
                let id = await createIndexID(publicKey, indexFile);
                let json = await userSession.getFile(indexFile, {
                    decrypt: true,
                    verify: true
                });
                let mediaEntry = JSON.parse(json);
                let encryptedJson = await userSession.encryptContent(json);
                let cachedIndex = {
                    data: encryptedJson,
                    id: id,
                    section: `${publicKey}_${mediaEntry.mediaType}`,
                    lastUpdated: mediaEntry.lastUpdatedUTC
                }
                await db.put('cached-indexes', cachedIndex);
                return true;
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

        const saveGaiaIndexesToCache = async (userName) => {
            let ret = 0;
            let hasExisting = false;
            try {
                let publicKey = blockstack.getPublicKeyFromPrivate(sessionData.userData.appPrivateKey);;
                let root = '';
                if (userName) {
                    root = getUserDirectory(publicKey);
                }
                let masterIndex = await getMasterIndex(root, userName);
                if (masterIndex) {
                    existingCache = {};
                    const index = db.transaction('cached-indexes').store.index('section');
                    if (index) {
                        for (let i = 0; i < mediaTypes?.length; i++) {
                            let cursor = await index.openCursor(`${publicKey}_${mediaTypes[i]}`);
                            while (cursor) {
                                existingCache[cursor.value.id] = cursor.value.lastUpdated;
                                hasExisting = true;
                                cursor = await cursor.continue();
                            }
                        }
                    }
                    let latestUpdated = null;
                    existing = {};
                    missing = [];
                    for (let indexFile in masterIndex) {
                        try {
                            let id = await createIndexID(publicKey, indexFile);
                            existing[id] = true;
                            let lastUpdated = masterIndex[indexFile];
                            let lastProcessed = existingCache[id];
                            if (!lastProcessed || (lastUpdated && lastUpdated > lastProcessed)) {
                                let json = await userSession.getFile(indexFile, {
                                    decrypt: true,
                                    verify: true,
                                    username: userName
                                });
                                let mediaEntry = JSON.parse(json);
                                if (!latestUpdated || latestUpdated < mediaEntry.lastUpdatedUTC) {
                                    latestUpdated = mediaEntry.lastUpdatedUTC;
                                }
                                let encryptedJson = await userSession.encryptContent(json);
                                let cachedIndex = {
                                    data: encryptedJson,
                                    id: id,
                                    section: `${publicKey}_${mediaEntry.mediaType}`,
                                    lastUpdated: mediaEntry.lastUpdatedUTC
                                }
                                await db.put('cached-indexes', cachedIndex);
                                ret++;
                            }
                        }
                        catch (mediaError) {
                            missing.push(indexFile)
                            console.log(mediaError);
                        }
                    }
                    if (!userName && missing.length > 0) {
                        missing.forEach(x => {
                            delete masterIndex[x];
                        })
                        await userSession.putFile("master-index", JSON.stringify(masterIndex), {
                            encrypt: true,
                            wasString: true,
                            sign: true
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
            return [ret, hasExisting];
        }

        let message;
        switch (e.data.message) {
            case "load":
                try {
                    await initializeDatabase();
                    initializeUserSession();
                    if (userSession?.isUserSignedIn()) {
                        let masterIndex;
                        try {
                            let json = await userSession.getFile('master-index', {
                                decrypt: true,
                                verify: true
                            });
                            masterIndex = JSON.parse(json);
                        }
                        catch {
                            masterIndex = await createMasterIndex();
                        }
                        let results = await saveGaiaIndexesToCache();
                        postMessage({
                            message: 'loadcomplete',
                            result: true,
                            addedCount: results[0],
                            hasExisting: results[1]
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