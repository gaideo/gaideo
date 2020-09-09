
import React from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import { useConnect } from '@blockstack/connect';
import VerticalTabs from '../vertical-tabs/VerticalTabs';
import Loader from 'react-loader-spinner';
import { usePromiseTracker } from 'react-promise-tracker';
import { Route, Switch, Redirect } from 'react-router-dom';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
      textAlign: 'center'
    },
  }),
);

export default function Main() {
  const classes = useStyles();
  const { doOpenAuth }: any = useConnect();
  const { authOptions } = useConnect();
  const { userSession } = authOptions;
  const { promiseInProgress } = usePromiseTracker();

  return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" className={classes.menuButton} color="inherit" style={{ outline: 'none' }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" className={classes.title}>
            Welcome to Gaideo, a privacy-based video sharing platform
          </Typography>
          {
            userSession?.isUserSignedIn() ?
              (
                <Button style={{ outline: 'none' }} color="inherit" onClick={() => { userSession?.signUserOut(); window.location.href = '/'; }}>Logout</Button>
              ) :
              (
                <Button style={{ outline: 'none' }} color="inherit" onClick={doOpenAuth}>Login</Button>
              )
          }
        </Toolbar>
      </AppBar>
      {
        promiseInProgress &&
        <div
          style={{
            width: "100%",
            height: "100",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <Loader type="ThreeDots" color="darkblue" height={100} width={100} />
        </div>
      }
      {
        userSession?.isUserSignedIn() &&
        <Switch>
          <Route path="/:section">
            <VerticalTabs />
          </Route>
          <Route path="/">
            <Redirect to="/0" />
          </Route>
        </Switch>
      }
    </div>
  );
}