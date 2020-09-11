import React, { useState, useEffect } from 'react';
import { makeStyles, Divider, List, ListItem, ListItemText, AppBar, Toolbar, Drawer, Typography, Hidden, IconButton, Button, Menu, MenuItem, CircularProgress, Backdrop } from "@material-ui/core";
import MenuIcon from '@material-ui/icons/MenuOutlined';
import PublishIcon from '@material-ui/icons/PublishOutlined';
import MovieIcon from '@material-ui/icons/MovieOutlined';
import EncryptIcon from '@material-ui/icons/EnhancedEncryptionOutlined';
import ContactIcon from '@material-ui/icons/ContactMailOutlined';
import { useConnect } from '@blockstack/connect';
import { UserData } from 'blockstack/lib/auth/authApp';
import AccountCircle from '@material-ui/icons/AccountCircle';
import { useHistory, Route, Switch, Redirect, useRouteMatch } from 'react-router-dom';
import { usePromiseTracker } from 'react-promise-tracker';
import { VideoPlayer } from '../video-player/VideoPlayer';
import { BrowseVideos } from '../browse-videos/BrowseVideos';
import PublishVideo from '../publish-video/PublishVideo';
import { VideoEncryption } from '../video-encryption/VideoEncryption';
import { ContactUs } from '../contact-us/ContactUs';

const drawerWidth = 240;
const useStyles = makeStyles((theme) => ({
    drawer: {
        maxWidth: drawerWidth,
        width: drawerWidth,
        flexShrink: 0,
    },
    toolbar: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        padding: theme.spacing(3),
        [theme.breakpoints.up('sm')]: {
            marginLeft: 250,
        },
    },
    title: {
        flexGrow: 1,
        verticalAlign: 'middle'
    },
    button: {
        outline: 'none',
        verticalAlign: 'middle'
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        color: '#fff',
    },
}));

export default function Main() {

    const classes = useStyles();
    const [state, setSmallDevice] = React.useState(false);
    const handleSmallDevice = () => {
        setSmallDevice(!state);
    };
    const { doOpenAuth }: any = useConnect();
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [userData, setUserData] = useState<UserData | null>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const history = useHistory();
    const { promiseInProgress } = usePromiseTracker();
    const publishRoute = useRouteMatch("/publish");
    const isPublish = window.location.hash.startsWith('#/publish');
    const isVideos = window.location.hash.startsWith('#/videos') || window.location.hash === '';
    const isEncrypt = window.location.hash.startsWith('#/encrypt');
    const isContactUs = window.location.hash.startsWith('#/contactus');
    const [publishSelected, setPublishSelected] = useState(isPublish);
    const [videosSelected, setVideosSelected] = useState(isVideos);
    const [encryptSelected, setEncryptSelected] = useState(isEncrypt);
    const [contactUsSelected, setContactUsSelected] = useState(isContactUs);

    if (!publishSelected && isPublish) {
        setPublishSelected(true);
    }
    else if (publishSelected && !isPublish) {
        setPublishSelected(false);
    }
    if (!videosSelected && isVideos) {
        setVideosSelected(true);
    }
    else if (videosSelected && !isVideos) {
        setVideosSelected(false);
    }
    if (!encryptSelected && isEncrypt) {
        setEncryptSelected(true);
    }
    else if (encryptSelected && !isEncrypt) {
        setEncryptSelected(false);
    }
    if (!contactUsSelected && isContactUs) {
        setContactUsSelected(true);
    }
    else if (contactUsSelected && !isContactUs) {
        setContactUsSelected(false);
    }

    useEffect(() => {

        const refresh = async () => {
            if (userSession?.isSignInPending()) {
                await userSession.handlePendingSignIn();
            }

        }
        refresh();
    }, [userSession, userData, publishRoute]);


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
        handleClose();
    };

    const navigateContent = (name: string) => {
        let path: string = '/videos/browse';
        setPublishSelected(name === "Publish")
        setEncryptSelected(name === "Encrypt Videos");
        setContactUsSelected(name === "Contact Us");
        setVideosSelected(name === "Videos")
        if (name === "Publish") {
            path = '/publish';
        }
        else if (name === "Encrypt Videos") {
            path = '/encrypt';
        }
        else if (name === "Contact Us") {
            path = '/contactus';
        }

        if (history.length > 0 && history.location.pathname !== path) {
            history.push(path);
        }
    }

    const drawer = (
        <div>
            <div>
                <Divider />
                <List>
                    <ListItem button selected={videosSelected} onClick={() => { navigateContent("Videos") }}>
                        <MovieIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Videos"} />
                    </ListItem>
                    <ListItem button selected={publishSelected} onClick={() => { navigateContent("Publish") }}>
                        <PublishIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Publish"} />
                    </ListItem>
                </List>
                <Divider />
                <List>
                    <ListItem button selected={encryptSelected} onClick={() => { navigateContent("Encrypt Videos") }}>
                        <EncryptIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Encrypt Videos"} />
                    </ListItem>
                    <ListItem button selected={contactUsSelected} onClick={() => { navigateContent("Contact Us") }}>
                        <ContactIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Contact Us"} />
                    </ListItem>
                </List>
            </div>
        </div>
    )
    return (
        <div>
            <AppBar position='fixed'>
                {
                    promiseInProgress &&
                    <Backdrop className={classes.backdrop} open={promiseInProgress}>
                        <CircularProgress color="inherit" />
                    </Backdrop>
                }

                <Toolbar style={{ justifyContent: 'space-between' }}>
                    <Hidden smUp implementation="css">
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge='start'
                            onClick={handleSmallDevice}
                        >  <MenuIcon />
                        </IconButton>
                        {userSession?.isUserSignedIn() &&
                            <Drawer
                                classes={{
                                    paper: classes.drawer,
                                }}
                                open={state}
                                onClose={handleSmallDevice}
                            >
                                {drawer}
                            </Drawer>
                        }
                        <Typography component="span" variant="h6" className={classes.title}>
                            Welcome to Gaideo
                        </Typography>
                    </Hidden>
                    <Hidden xsDown implementation="css">
                        {userSession?.isUserSignedIn() &&
                            <Drawer
                                classes={{
                                    paper: classes.drawer,
                                }}
                                open
                                variant='permanent'
                            >
                                {drawer}
                            </Drawer>
                        }
                        <Typography variant="h6" className={classes.title} style={{ paddingLeft: 250 }}>
                            Welcome to Gaideo, a secure way to internet
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
                                        <MenuItem onClick={() => { handleMenu("logout") }}>Logout</MenuItem>
                                    </Menu>
                                </div>
                            ) :
                            (
                                <Button style={{ marginTop: 3 }} color="inherit" onClick={async () => {
                                    await doOpenAuth(authOptions);
                                    if (userSession?.isSignInPending()) {
                                        setUserData(await userSession.handlePendingSignIn());
                                    }
                                }}>Login</Button>
                            )
                    }
                </Toolbar>
            </AppBar>
            {userSession?.isUserSignedIn() &&
                <div className={classes.content}>
                    <div style={{ paddingTop: 60, paddingLeft: 0, paddingRight: 0 }}>
                        <Switch>
                            <Route path="/videos/show/:id">
                                <VideoPlayer />
                            </Route>
                            <Route path="/videos/browse">
                                <BrowseVideos />
                            </Route>
                            <Route path="/publish/:id">
                                <PublishVideo />
                            </Route>
                            <Route path="/publish">
                                <PublishVideo />
                            </Route>
                            <Route path="/encrypt">
                                <VideoEncryption />
                            </Route>
                            <Route path="/contactus">
                                <ContactUs />
                            </Route>
                            <Route path="/">
                                <Redirect to="/videos/browse" />
                            </Route>
                        </Switch>
                    </div>                </div>
            }
        </div>
    );
}