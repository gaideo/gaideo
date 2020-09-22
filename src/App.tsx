import React, { useCallback, useEffect, useState } from 'react';
import 'fontsource-roboto';
import './App.css';
import { UserSession } from 'blockstack';
import { appConfig } from './assets/constants';
import { Connect } from '@blockstack/connect';
import { HashRouter } from 'react-router-dom';
import Main from './components/main/Main';
import { createMuiTheme, ThemeOptions, ThemeProvider } from '@material-ui/core';
import { UserData } from 'blockstack/lib/auth/authApp';
import { openDB, IDBPDatabase } from 'idb';

const userSession = new UserSession({ appConfig });

const themeObject: ThemeOptions = {
  palette: {
    type: 'light'
  }
}

export const GAIA_WORKER_INITIALIZE = 'GAIA_WORKER_INITIALIZE '

interface GaiaWorkerInitializeAction {
  type: typeof GAIA_WORKER_INITIALIZE
}

export type GaiaWorkerActionTypes = GaiaWorkerInitializeAction;

// TypeScript infers that this function is returning SendMessageAction
export function gaiaWorkerInitialize(): GaiaWorkerActionTypes {
  return {
    type: GAIA_WORKER_INITIALIZE
  }
}

export default function App() {
  const setUserDataCallback = useCallback((userData: UserData | null) => {
    setUserData(userData);
    if (userData) {
      /*
      userSession?.getFileUrl("deleteme", {
        username: "gaideofounder.id.blockstack"
      }).then(x => {
        console.log(x)
      })
      */
      /*      getNameInfo("gaideofounder.id.blockstack").then(x => {
              resolveZoneFileToProfile(x.zonefile, x.address).then(y => {
                console.log(y);
                let profile = y as any;
                if (profile) {
                  let appMeta = profile.appsMeta[document.location.origin];
                  if (appMeta) {
                    let publicKey = Buffer.from(appMeta.publicKey, 'hex');
                    let buffer = hashSha256Sync(publicKey);
                    console.log(buffer.toString('hex'));
                  }
                  console.log(appMeta);
                }
              })
            })
              .catch(error => {
                console.log(error);
              })
      */
    }

  }, []);

  const handleWorkerMessage = (e: any) => {
    if (e.data.result) {
      if (e.data.message === "loadcomplete") {
        if (e.data.addedCount > 0 && !e.data.hasExisting) {
          window.location.reload();
        }
      }
      else if (e.data.message === "cacheindexescomplete") {
        window.location.reload();
      }
      console.log(`Message ${e.data.message} succeeded`)
    }
    else {
      console.log(`Message ${e.data.message} failed`);
    }
  }
  const initGaiaWorker = () => {
    let w = new Worker('/gaia-worker.js');
    w.addEventListener('message', handleWorkerMessage);
    return w;
  }

  const initDatabase = async () => {
    let ret = await openDB("gaideodb", 1, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!oldVersion || oldVersion < 1) {
          const cachedIndexesStore = db.createObjectStore('cached-indexes', {
            keyPath: 'id'
          });
          cachedIndexesStore.createIndex('section', 'section');
          cachedIndexesStore.createIndex('lastUpdated', 'lastUpdated');
        }
      },
      blocked() {
      },
      blocking() {
        // …
      },
      terminated() {
        // …
      },

    });
    return ret;
  }

  const [worker] = useState(initGaiaWorker);
  const [db, setDB] = useState<IDBPDatabase<unknown> | null>(null);

  const [userData, setUserData] = useState<UserData | null>(null);
  const themeConfig = createMuiTheme(themeObject);
  const authOptions = {
    appDetails: {
      name: "Gaideo",
      icon: window.location.origin + '/icons/logo.svg',
    },
    userSession,
    finished: ({ userSession: UserSession }: any) => {
      if (userSession?.isUserSignedIn()) {
        let sessionData = localStorage.getItem("blockstack-session");
        if (sessionData && worker) {
          worker.postMessage({
            message: "load",
            sessionData: sessionData,
            location: document.location.href,
            origin: document.location.origin
          });
        }

      }
    },
  };


  useEffect(() => {
    const refresh = async () => {
      if (userSession?.isUserSignedIn()) {
        let database = await initDatabase();
        setDB(database);
        let sessionData = localStorage.getItem("blockstack-session");
        if (sessionData && worker) {
          worker.postMessage({
            message: "load",
            sessionData: sessionData,
            location: document.location.href,
            origin: document.location.origin
          });
        }
        let ud = userSession.loadUserData();
        setUserDataCallback(ud);
      }
    }
    refresh();
    return () => {
    }

  }, [worker, setUserDataCallback]);

  return (
    <ThemeProvider theme={themeConfig}>
      <Connect authOptions={authOptions}>
        <HashRouter>
          
          <Main userData={userData} setUserDataCallback={setUserDataCallback} db={db} worker={worker ? worker : null}/>
        </HashRouter>
      </Connect>
    </ThemeProvider>
  );
}
