import React, { useCallback, useState } from 'react';
import 'fontsource-roboto';
import './App.css';
import { UserSession } from 'blockstack';
import { appConfig } from './assets/constants';
import { Connect } from '@blockstack/connect';
import { HashRouter } from 'react-router-dom';
import Main from './components/main/Main';
import { createMuiTheme, ThemeOptions, ThemeProvider } from '@material-ui/core';
import { UserData } from 'blockstack/lib/auth/authApp';

const userSession = new UserSession({ appConfig });

const themeObject: ThemeOptions = {
  palette: {
    primary: { main: '#0a128f' },
    secondary: { main: '#5e3c6f' },
    type: 'light'
  }
}

export default function App() {
  const setUserDataCallback = useCallback((userData: UserData | null) => {
    setUserData(userData);
}, []);

  const [userData, setUserData] = useState<UserData | null>(null);
  const themeConfig = createMuiTheme(themeObject);
  const authOptions = {
    appDetails: {
      name: "Gaideo",
      icon: window.location.origin + '/icons/logo.svg',
    },
    userSession,
    finished:  ({ userSession }: any) => {
    },
  };
  return (
    <ThemeProvider theme={themeConfig}>
      <Connect authOptions={authOptions}>
        <HashRouter>
          <Main userData={userData} setUserDataCallback={setUserDataCallback}/>
        </HashRouter>
      </Connect>
    </ThemeProvider>
  );
}
