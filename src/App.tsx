import React, { Component } from 'react';
import 'fontsource-roboto';
import './App.css';
import { UserSession } from 'blockstack';
import { appConfig } from './assets/constants';
import { Connect } from '@blockstack/connect';
import Main from './components/main/Main';
import { HashRouter } from 'react-router-dom';

const userSession = new UserSession({ appConfig });

export default class App extends Component {

  render() {
    const authOptions = {
      appDetails: {
        name: "Gaideo",
        icon: window.location.origin + '/icons/logo.svg',
      },
      userSession,
      finished: ({ userSession }: any) => {
        this.setState({ userData: userSession.loadUserData() });
      },
    };
    return (
      <Connect authOptions={authOptions}>
        <HashRouter>
          <Main />
        </HashRouter>
      </Connect>
    );
  }
}
