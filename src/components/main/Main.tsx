import React, { useState, useEffect, useCallback } from 'react';
import { makeStyles, Divider, List, ListItem, ListItemText, AppBar, Toolbar, Drawer, Typography, Hidden, IconButton, Button, Menu, MenuItem, CircularProgress, Backdrop } from "@material-ui/core";
import MenuIcon from '@material-ui/icons/MenuOutlined';
import PublishIcon from '@material-ui/icons/PublishOutlined';
import MovieIcon from '@material-ui/icons/MovieOutlined';
import PeopleIcon from '@material-ui/icons/PeopleOutlined';
import EncryptIcon from '@material-ui/icons/EnhancedEncryptionOutlined';
import ContactIcon from '@material-ui/icons/ContactMailOutlined';
import CameraEnhanceOutlinedIcon from '@material-ui/icons/CameraEnhanceOutlined';
import { useConnect } from '@blockstack/connect';
import { UserData } from 'blockstack/lib/auth/authApp';
import AccountCircle from '@material-ui/icons/AccountCircle';
import CloseIcon from '@material-ui/icons/CloseOutlined';
import { useHistory, Route, Switch, Redirect, useRouteMatch } from 'react-router-dom';
import { usePromiseTracker } from 'react-promise-tracker';
import { VideoPlayer } from '../video-player/VideoPlayer';
import PublishVideo from '../publish-media/PublishMedia';
import { VideoEncryption } from '../video-encryption/VideoEncryption';
import { ContactUs } from '../contact-us/ContactUs';
import { BrowseImages } from '../browse-images/BrowseImages';
import { Photo } from '../../models/photo';
import { BrowseEntry } from '../../models/browse-entry';
import { Welcome } from '../welcome/Welcome';
import { HideOnScroll } from '../hide-on-scroll/HideOnScroll';
import { mobileCheck } from '../../utilities/responsive-utils';
import { BrowseVideos } from '../browse-videos/BrowseVideos';
import { IDBPDatabase } from 'idb';
import { Friends } from '../community/Friends';
import { Community } from '../community/Community';

const drawerWidth = 240;

interface SetUserDataCallback {
    (userData: UserData | null): void
}

interface MainProps {
    userData: UserData | null
    setUserDataCallback: SetUserDataCallback,
    db: IDBPDatabase<unknown> | null,
    worker: Worker | null
}

export default function Main(props: MainProps) {

    const { doOpenAuth }: any = useConnect();
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const welcomeRoute = useRouteMatch("/welcome");
    const browseImagesRoute = useRouteMatch("/images/browse");
    const [slideShowIndex, setSlideShowIndex] = useState<number | null>(null);

    const useStyles = makeStyles((theme) => ({
        drawer: {
            maxWidth: drawerWidth,
            flexShrink: 0,
        },
        toolbar: theme.mixins.toolbar,
        content: {
            flexGrow: 1,
            [theme.breakpoints.up('md')]: {
                marginLeft: userSession?.isUserSignedIn() && (!browseImagesRoute || slideShowIndex === null) ? 150 : undefined,
                padding: theme.spacing(0),
            },
        },
        title: {
            flexGrow: 1,
            verticalAlign: 'middle',
            whiteSpace: 'nowrap'
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

    const classes = useStyles();
    const [state, setSmallDevice] = React.useState(false);
    const handleSmallDevice = () => {
        setSmallDevice(!state);
    };
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const history = useHistory();
    const { promiseInProgress } = usePromiseTracker();
    const isPublish = window.location.hash.startsWith('#/publish');
    const isVideos = window.location.hash.startsWith('#/videos') || window.location.hash === '';
    const isImages = window.location.hash.startsWith('#/images');
    const isCommunity = window.location.hash.startsWith('#/community');
    const isEncrypt = window.location.hash.startsWith('#/encrypt');
    const isContactUs = window.location.hash.startsWith('#/contactus');
    const [publishSelected, setPublishSelected] = useState(isPublish);
    const [videosSelected, setVideosSelected] = useState(isVideos);
    const [imagesSelected, setImagesSelected] = useState(isImages);
    const [communitySelected, setCommunitySelected] = useState(isCommunity);
    const [encryptSelected, setEncryptSelected] = useState(isEncrypt);
    const [contactUsSelected, setContactUsSelected] = useState(isContactUs);
    const [photos, setPhotos] = useState(new Array<Photo>());
    const [videos, setVideos] = useState(new Array<BrowseEntry>());
    const [showClose, setShowClose] = useState(false);
    const [showFriends, setShowFriends] = useState(false);

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
    if (!imagesSelected && isImages) {
        setImagesSelected(true);
    }
    else if (imagesSelected && !isImages) {
        setImagesSelected(false);
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
    if (!communitySelected && isCommunity) {
        setCommunitySelected(true);
    }
    else if (communitySelected && !isCommunity) {
        setCommunitySelected(false);
    }

    useEffect(() => {
        const refresh = () => {

            if (userSession?.isSignInPending()) {
                let index = window.location.href.indexOf("authResponse=");
                if (index >= 0) {
                    let authResponse = window.location.href.substring(index + "authResponse=".length);
                    if (authResponse.endsWith('#/')) {
                        authResponse = authResponse.substring(0, authResponse.length - 2);
                    }
                    userSession.handlePendingSignIn(authResponse).then(ud => {
                        window.location.href = '/'
                    });
                }
            }

        }
        refresh();
    }, [userSession, props.userData, history]);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (showClose) {
            toggleCloseCallback();
        }
        else {
            setAnchorEl(event.currentTarget);
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const handleMenu = (option: string) => {
        if (option === 'logout') {
            userSession?.signUserOut();
            window.location.href = '/';
        }
        else if (option === 'friends') {
            setShowFriends(true);
        }
        handleClose();
    };

    const navigateContent = (name: string) => {
        let path: string = '/videos/browse';
        setPublishSelected(name === "Publish")
        setEncryptSelected(name === "Encrypt Videos");
        setContactUsSelected(name === "Contact Us");
        setVideosSelected(name === "Videos")
        setCommunitySelected(name === "Community");

        if (name === "Publish") {
            path = '/publish';
        }
        else if (name === "Photos") {
            path = "/images/browse";
        }
        else if (name === "Community") {
            path = "/community";
        }
        else if (name === "Encrypt Videos") {
            path = '/encrypt';
        }
        else if (name === "Contact Us") {
            path = '/contactus';
        }
        else if (name === "Welcome") {
            path = '/welcome';
        }
        if (history.length > 0 && history.location.pathname !== path) {
            history.push(path);
        }
    }

    const imagesLoadedCallback = useCallback((photos: Photo[]) => {
        setPhotos(photos);
    }, []);

    const videosLoadedCallback = useCallback((videos: BrowseEntry[]) => {
        setVideos(videos);
    }, []);

    const toggleCloseCallback = useCallback(() => {
        if (showClose) {
            setSlideShowIndex(null);
        }
        setShowClose(!showClose);
    }, [showClose]);

    const setSlideShowIndexCallback = useCallback((index: number | null) => {
        setSlideShowIndex(index);
        if (index === null) {
            setShowClose(false);
        }
    }, []);

    const showFriendsCallback = useCallback((show: boolean) => {
        setShowFriends(show);
    }, []);

    const drawer = (
        <div>
            <div>
                <Divider />
                <List>
                    <ListItem button selected={videosSelected} onClick={() => { navigateContent("Videos") }}>
                        <MovieIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Videos"} />
                    </ListItem>
                    <ListItem button selected={imagesSelected} onClick={() => { navigateContent("Photos") }}>
                        <CameraEnhanceOutlinedIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Photos"} />
                    </ListItem>
                    <ListItem button selected={publishSelected} onClick={() => { navigateContent("Publish") }}>
                        <PublishIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Publish"} />
                    </ListItem>
                    <ListItem button selected={communitySelected} onClick={() => { navigateContent("Community") }}>
                        <PeopleIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Community"} />
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

    const isMobile = mobileCheck();

    const appBar = (
        <AppBar style={{ visibility: browseImagesRoute && slideShowIndex != null ? 'hidden' : undefined, backgroundColor: '#d4e3ea', color: 'rgba(0,0,0,.87)' }} position='fixed'>
            {
                promiseInProgress &&
                <Backdrop className={classes.backdrop} open={promiseInProgress}>
                    <CircularProgress color="inherit" />
                </Backdrop>
            }

            <Toolbar disableGutters={true} style={{ whiteSpace: 'nowrap', justifyContent: 'space-between', height: 40, minHeight: 40 }}>
                <Hidden mdUp implementation="css">
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge={'start'}
                        onClick={handleSmallDevice}
                        style={{ paddingTop: 0, paddingBottom: 0, paddingLeft: 20, minWidth: 40 }}
                    >  <MenuIcon />
                    </IconButton>
                    {userSession?.isUserSignedIn() &&
                        <Drawer
                            style={{ width: state ? drawerWidth : 0 }}
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
                        Gaideo
                </Typography>
                </Hidden>
                <Hidden smDown implementation="css">
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
                    <Typography variant="h6" className={classes.title} style={{ paddingLeft: userSession?.isUserSignedIn() ? 180 : 0 }}>
                        Gaideo
                </Typography>
                </Hidden>
                {
                    userSession?.isUserSignedIn() ?
                        (
                            <div>
                                <IconButton
                                    onClick={handleClick}
                                    color="inherit"
                                    style={{ paddingTop: 0, paddingBottom: 0, paddingLeft: 10, paddingRight: 10, minWidth: 40 }}
                                >
                                    {showClose && browseImagesRoute ? (
                                        <CloseIcon />

                                    ) : (
                                            <AccountCircle />
                                        )}
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
                                    <MenuItem onClick={() => { handleMenu("friends") }}>Friends</MenuItem>
                                    <MenuItem onClick={() => { handleMenu("logout") }}>Logout</MenuItem>
                                </Menu>
                            </div>
                        ) :
                        (
                            <Button style={{ marginTop: 3 }} color="inherit" onClick={async () => {
                                await doOpenAuth(authOptions);
                                if (userSession?.isSignInPending()) {
                                    console.log('sign in pending');
                                    let ud = await userSession.handlePendingSignIn();
                                    props.setUserDataCallback(ud);
                                }

                            }}>Login</Button>
                        )
                }
            </Toolbar>
        </AppBar>
    )

    return (
        <div style={{ backgroundImage: userSession?.isUserSignedIn() ? 'none' : 'url(/welcome.jpg)' }}>
            {isMobile ? (
                <HideOnScroll>
                    {appBar}
                </HideOnScroll>
            ) : appBar}
            <div className={classes.content} style={{ marginLeft: welcomeRoute ? 0 : undefined }}>

                <div style={{ paddingTop: browseImagesRoute && slideShowIndex != null ? 0 : 18, paddingLeft: 0, paddingRight: 0 }}>
                    <Friends show={showFriends} showCallback={showFriendsCallback} isMobile={isMobile} />

                    <Switch>
                        <Route path="/videos/show/:id">
                            {userSession?.isUserSignedIn() ? (
                                <VideoPlayer />
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/videos/browse">
                            {userSession?.isUserSignedIn() ? (
                                <div style={{ paddingTop: 10 }}>
                                    <BrowseVideos videos={videos} videosLoadedCallback={videosLoadedCallback} db={props.db} />
                                </div>
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/images/browse">
                            {userSession?.isUserSignedIn() ? (
                                <BrowseImages
                                    photos={photos}
                                    imagesLoadedCallback={imagesLoadedCallback}
                                    toggleCloseCallback={toggleCloseCallback}
                                    slideShowIndex={slideShowIndex}
                                    setSlideShowIndexCallback={setSlideShowIndexCallback}
                                    db={props.db} />
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/publish/:id">
                            {userSession?.isUserSignedIn() ? (
                                <PublishVideo
                                    worker={props.worker}
                                    videos={videos}
                                    videosLoadedCallback={videosLoadedCallback}
                                    photos={photos}
                                    imagesLoadedCallback={imagesLoadedCallback} 
                                    isMobile={isMobile}/>
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/publish">
                            {userSession?.isUserSignedIn() ? (
                                <PublishVideo
                                    worker={props.worker}
                                    videos={videos}
                                    videosLoadedCallback={videosLoadedCallback}
                                    photos={photos}
                                    imagesLoadedCallback={imagesLoadedCallback} 
                                    isMobile={isMobile}/>
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/community">
                            {userSession?.isUserSignedIn() ? (
                                <div style={{ paddingTop: 25, paddingLeft: !isMobile ? 22 : 0 }}>
                                    <Community />
                                </div>
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/encrypt">
                            {userSession?.isUserSignedIn() ? (
                                <div style={{ paddingTop: 50, paddingLeft: !isMobile ? 22 : 0 }}>
                                    <VideoEncryption />
                                </div>
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/contactus">
                            {userSession?.isUserSignedIn() ? (
                                <div style={{ paddingTop: 50, paddingLeft: !isMobile ? 22 : 0 }}>
                                    <ContactUs />
                                </div>
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/">
                            {userSession?.isUserSignedIn() ? (
                                <Redirect to="/videos/browse" />
                            ) : (
                                    <Welcome />
                                )
                            }
                        </Route>
                        <Route path="/welcome">
                            <Welcome />
                        </Route>
                    </Switch>
                </div>
            </div>
        </div>
    );
}