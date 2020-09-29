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

export default function App() {
  const setUserDataCallback = useCallback((userData: UserData | null) => {
    setUserData(userData);
  }, []);


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

  const initGaiaWorker = () => {
    let w = new Worker('/scripts/workers/gaia-worker.js');
    w.addEventListener('message', (e) => {
      if (e.data.result) {
        switch (e.data.message) {
          case "ready":
            let sessionData = localStorage.getItem("blockstack-session");
            if (sessionData) {
              w.postMessage({
                message: "load",
                sessionData: sessionData
              })
            }
            break;
          case "loadcomplete":
            if (e.data.addedCount > 0 && !e.data.hasExisting) {
              window.location.reload();
            }
            break;
          case "cacheindexescomplete":
            window.location.reload();
            break;
          case "deletedbcomplete":
            window.location.reload();
            break;
        }
        console.log(`Message ${e.data.message} succeeded`)
      }
      else {
        console.log(`Message ${e.data.message} failed`);
      }
    });
    return w;
  }

  const [worker, setWorker] = useState<Worker | null>(null);
  const [db, setDB] = useState<IDBPDatabase<unknown> | null>(null);

  const [userData, setUserData] = useState<UserData | null>(null);
  const themeConfig = createMuiTheme(themeObject);
  const authOptions = {
    appDetails: {
      name: "Gaideo",
      icon: window.location.origin + '/icons/logo.svg',
    },
    userSession,
    finished: async ({ userSession: UserSession }: any) => {
      let database = await initDatabase();
      setDB(database);
      let ud = userSession.loadUserData();
      setUserDataCallback(ud);
      setWorker(initGaiaWorker());
    },
  };


  useEffect(() => {
    const refresh = async () => {
      if (userSession?.isUserSignedIn()) {
        let database = await initDatabase();
        setDB(database);
        let ud = userSession.loadUserData();
        setUserDataCallback(ud);
        setWorker(initGaiaWorker());
      }
    }
    refresh();
    return () => {
    }

  }, [setUserDataCallback, setWorker]);

  return (
    <ThemeProvider theme={themeConfig}>
      <Connect authOptions={authOptions}>
        <HashRouter>

          <Main userData={userData} setUserDataCallback={setUserDataCallback} db={db} worker={worker ? worker : null} />
        </HashRouter>
      </Connect>
    </ThemeProvider>
  );
}
