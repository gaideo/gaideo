
import React, { useEffect, useState } from 'react';
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
import { Hidden, Menu, MenuItem } from '@material-ui/core';
import AccountCircle from '@material-ui/icons/AccountCircle';
import { UserData } from 'blockstack/lib/auth/authApp';

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
  const [userData, setUserData] = useState<UserData | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  useEffect(() => {

    const refresh = async () => {
      if (userSession?.isSignInPending()) {
        await userSession.handlePendingSignIn();
      }

    }
    refresh();
  }, [userSession, userData]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
};

const handleClose = () => {
    setAnchorEl(null);
}

const handleMenu = (option: string) => {
    if (option === 'logout') {
      userSession?.signUserOut(); 
      window.location.href = '/';
    }
    else if (option === 'encrypt') {
      window.location.href = 'https://hub.docker.com/repository/docker/gaideo/gaideo-encrypt';
    }
    handleClose();
};

  return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" className={classes.menuButton} color="inherit" style={{ outline: 'none' }}>
            <MenuIcon></MenuIcon>
          </IconButton>
          <Hidden smDown>
            <Typography variant="h6" className={classes.title}>
              Welcome to Gaideo, a privacy-based video sharing platform
            </Typography>
          </Hidden>
          <Hidden mdUp>
            <Typography variant="h6" className={classes.title}>
              Welcome to Gaideo
            </Typography>
          </Hidden>
          {
            userSession?.isUserSignedIn() ?
              (
                <div>
                  <IconButton
                    onClick={handleClick}
                    color="inherit"
                  >
                    <AccountCircle />
                  </IconButton>
                  <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={open}
                    onClose={handleClose}
                  >
                    <MenuItem onClick={() => { handleMenu("profile") }}>Profile</MenuItem>
                    <MenuItem onClick={() => { handleMenu("encrypt") }}>Encrypt Videos</MenuItem>
                    <MenuItem onClick={() => { handleMenu("logout") }}>Logout</MenuItem>
                  </Menu>
                </div>
              ) :
              (
                <Button style={{ outline: 'none' }} color="inherit" onClick={async () => {
                  await doOpenAuth(authOptions);
                  if (userSession?.isSignInPending()) {
                    setUserData(await userSession.handlePendingSignIn());
                  }
              }}>Login</Button>
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