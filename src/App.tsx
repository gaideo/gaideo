import React, { Component, useState } from 'react';
import 'fontsource-roboto';
import './App.css';
import { UserSession } from 'blockstack';
import { appConfig } from './assets/constants';
import { Connect } from '@blockstack/connect';
import { HashRouter } from 'react-router-dom';
import Main from './components/main/Main';
import { createMuiTheme, ThemeOptions, ThemeProvider } from '@material-ui/core';

const userSession = new UserSession({ appConfig });

const themeObject : ThemeOptions = {
  palette: {
    primary: { main: '#0a128f'},
    secondary: { main: '#5e3c6f'},
    type: 'light'
  }
}

export default function App() {  
  const themeConfig = createMuiTheme(themeObject);
  const authOptions = {
    appDetails: {
      name: "Gaideo",
      icon: window.location.origin + '/icons/logo.svg',
    },
    userSession,
    finished: ({ userSession }: any) => {
      if (userSession?.isUserSignedIn()) {
        console.log('Sign-in complete.');
      }
    },
  };
  return (
    <ThemeProvider theme={themeConfig}>
      <Connect authOptions={authOptions}>
        <HashRouter>
          <Main />
        </HashRouter>
      </Connect>
    </ThemeProvider>
    );
}
