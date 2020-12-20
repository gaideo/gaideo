import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { makeStyles, Divider, List, ListItem, ListItemText, AppBar, Toolbar, Drawer, Typography, Hidden, IconButton, Button, Menu, MenuItem, CircularProgress, Backdrop, Icon, LinearProgress, withStyles, Theme, createStyles, Badge } from "@material-ui/core";
import MenuIcon from '@material-ui/icons/MenuOutlined';
import PublishIcon from '@material-ui/icons/PublishOutlined';
import MovieIcon from '@material-ui/icons/MovieOutlined';
import EncryptIcon from '@material-ui/icons/EnhancedEncryptionOutlined';
import ContactIcon from '@material-ui/icons/ContactMailOutlined';
import SearchIcon from '@material-ui/icons/Search';
import CameraEnhanceOutlinedIcon from '@material-ui/icons/CameraEnhanceOutlined';
import MusicNoteIcon from '@material-ui/icons/MusicNoteOutlined';
import { useConnect } from '@blockstack/connect';
import { UserData } from 'blockstack/lib/auth/authApp';
import AccountCircle from '@material-ui/icons/AccountCircle';
import CloseIcon from '@material-ui/icons/CloseOutlined';
import { useHistory, Route, Switch, Redirect, useRouteMatch } from 'react-router-dom';
import { trackPromise, usePromiseTracker } from 'react-promise-tracker';
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
import { Friends } from '../friends/Friends';
import ProfileDialog from '../profile-dialog/ProfileDialog';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';
import { listFiles, saveSelectedShares, saveSelectedGroup } from '../../utilities/gaia-utils';
import { Playlists } from '../playlists/Playlists';
import { Search } from '../search/Search';
import { MusicType, VideosType } from '../../utilities/media-utils';

const drawerWidth = 240;

interface SetUserDataCallback {
    (userData: UserData | null): void
}

interface SetNewCountCallback {
    (count: number): void
}

interface MainProps {
    userData: UserData | null;
    setUserDataCallback: SetUserDataCallback;
    db: IDBPDatabase<unknown> | null;
    worker: Worker | null;
    newVideosCount: number;
    setNewVideosCountCallback: SetNewCountCallback;
    newPhotosCount: number;
    setNewPhotosCountCallback: SetNewCountCallback;
    newMusicCount: number;
    setNewMusicCountCallback: SetNewCountCallback;
}

export default function Main(props: MainProps) {

    const { doOpenAuth }: any = useConnect();
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const welcomeRoute = useRouteMatch("/welcome");
    const videoPlayerRoute = useRouteMatch("/videoplayer/")
    const browseImagesRoute = useRouteMatch("/images/browse");
    const [slideShowIndex, setSlideShowIndex] = useState<number | null>(null);
    const [progressMessage, setProgressMessage] = useState<string | null>(null);
    const [progressSubMessage, setProgressSubMessage] = useState<string | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [confirmResetCacheOpen, setConfirmResetCacheOpen] = React.useState(false);
    const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = React.useState(false);
    const [searchText, setSearchText] = React.useState('')

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
    const isMusic = window.location.hash.startsWith('#/music') || window.location.hash === '';
    const isImages = window.location.hash.startsWith('#/images');
    const isEncrypt = window.location.hash.startsWith('#/encrypt');
    const isContactUs = window.location.hash.startsWith('#/contactus');
    const [publishSelected, setPublishSelected] = useState(isPublish);
    const [videosSelected, setVideosSelected] = useState(isVideos);
    const [imagesSelected, setImagesSelected] = useState(isImages);
    const [songsSelected, setSongsSelected] = useState(isMusic);
    const [encryptSelected, setEncryptSelected] = useState(isEncrypt);
    const [contactUsSelected, setContactUsSelected] = useState(isContactUs);
    const [photos, setPhotos] = useState(new Array<Photo>());
    const [videos, setVideos] = useState(new Array<BrowseEntry>());
    const [songs, setSongs] = useState(new Array<BrowseEntry>());
    const [showClose, setShowClose] = useState(false);
    const [showFriends, setShowFriends] = useState(false);
    const [showPlaylists, setShowPlaylists] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

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
    if (!songsSelected && isMusic) {
        setSongsSelected(true)
    }
    else if (songsSelected && !isMusic) {
        setSongsSelected(false);
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
        if (!promiseInProgress) {
            setProgressMessage(null);
            setProgressSubMessage(null);
        }
    }, [promiseInProgress])

    useEffect(() => {
        const refresh = async () => {

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

    const isInWebView = () => {
        const w: any = window;
        return w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.gaideoMessageHandler;
    }

    const handleMenu = (option: string) => {
        if (option === 'logout') {
            userSession?.signUserOut();
            window.location.href = '/';
        }
        else if (option === 'friends') {
            setShowFriends(true);
            setShowPlaylists(false);
            setShowSearch(false);
        }
        else if (option === 'playlists') {
            setShowPlaylists(true);
            setShowFriends(false);
            setShowSearch(false);
        }
        else if (option === 'profile') {
            setProfileOpen(true);
        }
        else if (option === 'resetcache') {
            setConfirmResetCacheOpen(true)
        }
        else if (option === 'deleteall') {
            setConfirmDeleteAllOpen(true)
        }
        else if (option === 'appfunction') {
            if (isInWebView()) {
                document.location.reload();
            }
            else if (userSession?.isUserSignedIn()) {
                listFiles(userSession);
            }
        }
        handleClose();
    };

    const navigateContent = (name: string) => {
        let path: string = '/videos/browse';
        const selVideos = (name === "Videos");
        const selImages = (name === "Photos");
        const selSongs = (name === "Music");

        setPublishSelected(name === "Upload")
        setEncryptSelected(name === "Encrypt Videos");
        setContactUsSelected(name === "Contact Us");
        setVideosSelected(selVideos)
        setImagesSelected(selImages);
        setSongsSelected(selSongs);

        if (name === "Upload") {
            path = '/publish';
        }
        else if (name === "Photos") {
            path = "/images/browse";
        }
        else if (name === "Music") {
            path ="/music/browse";
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
        if (selVideos && props.newVideosCount > 0) {
            props.setNewVideosCountCallback(0);
            setVideos(new Array<BrowseEntry>());
        }
        else if (selImages && props.newPhotosCount > 0) {
            props.setNewPhotosCountCallback(0);
            setPhotos(new Array<Photo>());
        }
        else if (selSongs && props.newMusicCount > 0) {
            props.setNewMusicCountCallback(0);
            setSongs(new Array<BrowseEntry>());
        }
    }

    const imagesLoadedCallback = useCallback((newPhotos: Photo[]) => {
        if (photos.length > 0 || newPhotos.length !== 0) {
            setPhotos(newPhotos);
        }
    }, [photos]);

    const videosLoadedCallback = useCallback((newVideos: BrowseEntry[]) => {
        if (videos.length > 0 || newVideos.length !== 0) {
            setVideos(newVideos);
        }
    }, [videos]);

    const songsLoadedCallback = useCallback((newSongs: BrowseEntry[]) => {
        if (songs.length > 0 || newSongs.length !== 0) {
            setSongs(newSongs);
        }
    }, [songs]);

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

    const showPlaylistsCallback = useCallback((show: boolean) => {
        setShowPlaylists(show);
    }, []);

    const showSearchCallback = useCallback((show: boolean) => {
        setShowSearch(show);
    }, []);

    const updateProgressCallback = useCallback((message: string | null, subMessage: string | null) => {
        setProgressMessage(message);
        setProgressSubMessage(subMessage);
    }, []);

    const setProfileDialogOpenCallback = useCallback((open: boolean) => {
        setProfileOpen(open);
    }, []);

    const saveSelectedFriendsCallback = useCallback(async (selected: Array<any> | undefined | null) => {
        let arr: string[] = [];
        if (selected) {
            for (let i = 0; i < selected.length; i++) {
                arr.push(selected[i].value);
            }
        }
        if (userSession?.isUserSignedIn()) {
            await saveSelectedShares(userSession, arr);
        }
        setVideos(new Array<BrowseEntry>());
        setPhotos(new Array<Photo>());
        setSongs(new Array<BrowseEntry>());
    }, [userSession]);

    const saveSelectedPlaylistCallback = useCallback(async (selected: string | null) => {
        if (userSession?.isUserSignedIn()) {
            await saveSelectedGroup(userSession, selected);
        }
        setVideos(new Array<BrowseEntry>());
        setPhotos(new Array<Photo>());
        setSongs(new Array<BrowseEntry>());
    }, [userSession]);

    const setSearchTextCallback = useCallback((text: string) => {
        setSearchText(text);
        setVideos(new Array<BrowseEntry>());
        setPhotos(new Array<Photo>());
        setSongs(new Array<BrowseEntry>());
    }, [])

    const resetCachedIndexes = async () => {
        try {
            await props.db?.close();
            props.worker?.postMessage({
                message: 'deletedb',
            });
        }
        catch (error) {
            console.log(error);
        }
    }

    const deleteAll = async () => {

        let deleteme: string[] = [];
        try {
            await userSession?.listFiles((name: string) => {
                deleteme.push(name);
                return true;
            });
            for (let i = 0; i < deleteme.length; i++) {
                setProgressMessage(`Deleting ${deleteme[i]} (${i + 1}/${deleteme.length})`);
                await userSession?.deleteFile(deleteme[i])
            }

        }
        catch (error) {
            console.log(`Unable to delete all data: ${error}.`);
        }
        await resetCachedIndexes();
    }

    const resetCacheConfirmResult = (item: any, result: boolean) => {
        setConfirmResetCacheOpen(false);
        if (result) {
            trackPromise(resetCachedIndexes());
        }
    }

    const deleteAllConfirmResult = (item: any, result: boolean) => {
        setConfirmDeleteAllOpen(false);
        if (result) {
            trackPromise(deleteAll());
        }
    }

    const showNewVideos = () => {
        if (props.newVideosCount > 0) {
            return true;
        }
        return false;
    }

    const showNewImages = () => {
        if (props.newPhotosCount > 0) {
            return true;
        }
        return false;
    }

    const showNewMusic = () => {
        if (props.newMusicCount > 0) {
            return true;
        }
        return false;
    }

    const drawer = (
        <div>
            <div>
                <Divider />
                <List style={{ paddingTop: 0 }}>
                    <ListItem button selected={videosSelected} onClick={() => { navigateContent("Videos") }}>
                        <MovieIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Videos"} />
                        <Badge invisible={!showNewVideos()} badgeContent={props.newVideosCount} color="secondary">
                        </Badge>
                    </ListItem>
                    <ListItem button selected={imagesSelected} onClick={() => { navigateContent("Photos") }}>
                        <CameraEnhanceOutlinedIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Photos"} />
                        <Badge invisible={!showNewImages()} badgeContent={props.newPhotosCount} color="secondary">
                        </Badge>
                    </ListItem>
                    <ListItem button selected={songsSelected} onClick={() => { navigateContent("Music") }}>
                        <MusicNoteIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Music"} />
                        <Badge invisible={!showNewMusic()} badgeContent={props.newMusicCount} color="secondary">
                        </Badge>
                    </ListItem>
                    <ListItem button selected={publishSelected} onClick={() => { navigateContent("Upload") }}>
                        <PublishIcon style={{ paddingRight: 5 }} />
                        <ListItemText primary={"Upload"} />
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

    const BorderLinearProgress = withStyles((theme: Theme) =>
        createStyles({
            root: {
                height: 10,
                borderRadius: 5,
            },
            bar: {
                borderRadius: 5,
            },
        }),
    )(LinearProgress);

    const appfuncTitle = isInWebView() ? "Refresh" : "List Files";

    const appBar = (
        <AppBar style={{ visibility: browseImagesRoute && slideShowIndex != null ? 'hidden' : undefined, backgroundColor: '#d4e3ea', color: 'rgba(0,0,0,.87)' }} position='fixed'>
            {
                promiseInProgress &&
                <Backdrop className={classes.backdrop} open={promiseInProgress}>
                    {progressMessage ? (
                        <div style={{
                            backgroundColor: 'gray',
                            borderRadius: 16,
                            padding: 20,
                            border: progressMessage && progressMessage?.length > 0 ? '1px solid' : undefined,
                            borderColor: 'white',
                            maxWidth: 800,
                            wordWrap: 'break-word'
                        }}>

                            <div>
                                <Typography variant="h6">{progressMessage}</Typography>
                            </div>

                            <div>
                                <Typography variant="h6">{progressSubMessage}</Typography>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
                                <div style={{ width: '100%' }}>
                                    <BorderLinearProgress />
                                </div>
                            </div>
                        </div>
                    ) : (
                            <CircularProgress color="inherit" />
                        )
                    }
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
                    <div style={{ display: 'flex', flexDirection: 'row', paddingLeft: userSession?.isUserSignedIn() ? 180 : 0 }}>
                        <div>
                            <Icon>
                                {isVideos ? <MovieIcon />
                                    : isImages ? <CameraEnhanceOutlinedIcon />
                                        : isMusic ? <MusicNoteIcon />
                                            : isPublish ? <PublishIcon />
                                                : isEncrypt ? <EncryptIcon />
                                                    : isContactUs ? <ContactIcon />
                                                        : <div></div>}
                            </Icon>
                        </div>
                        <div style={{ marginBottom: 0, marginTop: -2, paddingLeft: 5 }}>
                            <Typography variant="h6" className={classes.title}>
                                Gaideo
                          </Typography>
                        </div>
                    </div>
                </Hidden>
                {
                    userSession?.isUserSignedIn() ?
                        (
                            <div style={{ display: 'flex', flexDirection: 'row' }}>
                                <IconButton
                                    color="inherit"
                                    onClick={() => { setShowSearch(true); setShowFriends(false); setShowPlaylists(false); }}
                                    style={{ paddingTop: 0, paddingBottom: 0, paddingLeft: 10, paddingRight: 10, minWidth: 40 }}>
                                    <SearchIcon />
                                </IconButton>
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
                                    <MenuItem onClick={() => { handleMenu("playlists") }}>Playlists</MenuItem>
                                    <MenuItem onClick={() => { handleMenu("resetcache") }}>Reset Cache</MenuItem>
                                    <MenuItem onClick={() => { handleMenu("deleteall") }}>Delete All Data</MenuItem>
                                    <MenuItem onClick={() => { handleMenu("appfunction") }}>{appfuncTitle}</MenuItem>
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

    const body = window?.document?.body;
    if (body) {
        if (userSession?.isUserSignedIn() || videoPlayerRoute) {
            body.style.backgroundImage = "none";
        }
        else {
            body.style.backgroundImage = "url(/welcome.jpg)"
        }
    }
    return (
        <Fragment>
            <ConfirmDialog open={confirmResetCacheOpen} item={null} onResult={resetCacheConfirmResult} title="Confirm Reset Cache" message={`Are you sure you want to reset your cached indexes?`} />
            <ConfirmDialog open={confirmDeleteAllOpen} item={null} onResult={deleteAllConfirmResult} title="Confirm Delete All" message={`Are you sure you want to delete all of your Gaideo data?`} />
            {videoPlayerRoute ? (
                <Switch>
                    <Route path="/videoplayer/:access/:type/:owner/:id">
                        <VideoPlayer isMobile={isMobile} db={props.db} />
                    </Route>
                </Switch>
            )
                : (
                    <div>
                        {isMobile ? (
                            <HideOnScroll>
                                {appBar}
                            </HideOnScroll>
                        ) : appBar}
                        <ProfileDialog userName={props.userData?.username} open={profileOpen} setProfileDialogOpenCallback={setProfileDialogOpenCallback} />
                        <div className={classes.content} style={{ marginLeft: welcomeRoute ? 0 : undefined }}>

                            <div style={{ paddingTop: browseImagesRoute && slideShowIndex != null ? 0 : 18, paddingLeft: 0, paddingRight: 0 }}>
                                <Friends show={showFriends} showCallback={showFriendsCallback} isMobile={isMobile} saveSelectedFriendsCallback={saveSelectedFriendsCallback} />
                                <Playlists show={showPlaylists} showCallback={showPlaylistsCallback} isMobile={isMobile} saveSelectedPlaylistCallback={saveSelectedPlaylistCallback} db={props.db} />
                                <Search show={showSearch} showCallback={showSearchCallback} isMobile={isMobile} setSearchTextCallback={setSearchTextCallback} />

                                <Switch>
                                    <Route path="/videos/show/:access/:type/:id/:owner">
                                        {userSession?.isUserSignedIn() ? (
                                            <VideoPlayer isMobile={isMobile} db={props.db} />
                                        ) : (
                                                <Welcome />
                                            )
                                        }
                                    </Route>
                                    <Route path="/videos/browse">
                                        {userSession?.isUserSignedIn() ? (
                                            <div style={{ paddingTop: !showFriends && !showPlaylists ? 30 : 10 }}>
                                                <BrowseVideos
                                                    videos={videos}
                                                    videosLoadedCallback={videosLoadedCallback}
                                                    db={props.db}
                                                    worker={props.worker}
                                                    updateProgressCallback={updateProgressCallback}
                                                    isMobile={isMobile}
                                                    searchText={searchText}
                                                    mediaType={VideosType} />
                                            </div>
                                        ) : (
                                                <Welcome />
                                            )
                                        }
                                    </Route>
                                    <Route path="/images/browse">
                                        {userSession?.isUserSignedIn() ? (
                                            <div style={{ paddingTop: !showFriends && !showPlaylists ? 25 : 5 }}>
                                                <BrowseImages
                                                    photos={photos}
                                                    imagesLoadedCallback={imagesLoadedCallback}
                                                    toggleCloseCallback={toggleCloseCallback}
                                                    slideShowIndex={slideShowIndex}
                                                    setSlideShowIndexCallback={setSlideShowIndexCallback}
                                                    db={props.db}
                                                    worker={props.worker}
                                                    isMobile={isMobile}
                                                    updateProgressCallback={updateProgressCallback}
                                                    searchText={searchText} />
                                            </div>
                                        ) : (
                                                <Welcome />
                                            )
                                        }
                                    </Route>
                                    <Route path="/music/browse">
                                        {userSession?.isUserSignedIn() ? (
                                            <div style={{ paddingTop: !showFriends && !showPlaylists ? 30 : 10 }}>
                                                <BrowseVideos
                                                    videos={songs}
                                                    videosLoadedCallback={songsLoadedCallback}
                                                    db={props.db}
                                                    worker={props.worker}
                                                    updateProgressCallback={updateProgressCallback}
                                                    isMobile={isMobile}
                                                    searchText={searchText}
                                                    mediaType={MusicType} />
                                            </div>
                                        ) : (
                                                <Welcome />
                                            )
                                        }
                                    </Route>
                                    <Route path="/publish/:type/:id">
                                        {userSession?.isUserSignedIn() ? (
                                            <PublishVideo
                                                worker={props.worker}
                                                videos={videos}
                                                photos={photos}
                                                songs={songs}
                                                isMobile={isMobile}
                                                videosLoadedCallback={videosLoadedCallback}
                                                imagesLoadedCallback={imagesLoadedCallback}
                                                songsLoadedCallback={songsLoadedCallback}
                                                updateProgressCallback={updateProgressCallback}
                                            />
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
                                                photos={photos}
                                                songs={songs}
                                                isMobile={isMobile}
                                                videosLoadedCallback={videosLoadedCallback}
                                                imagesLoadedCallback={imagesLoadedCallback}
                                                songsLoadedCallback={songsLoadedCallback}
                                                updateProgressCallback={updateProgressCallback}
                                            />
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
                )}

        </Fragment>
    );
}