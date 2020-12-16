import React, { Fragment, useEffect } from 'react';
import { useConnect } from '@blockstack/connect';
import { Toolbar, Typography, IconButton, Menu, Button } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import "./BrowseVideos.css";
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useHistory } from 'react-router-dom';
import { getCacheEntries, getShares, shareFile, getSelectedShares, getSelectedGroup, addToGroup, getCacheEntriesFromGroup, removeFromGroup, isFileShared, getCacheEntriesFromSearch } from '../../utilities/gaia-utils';
import { deleteVideoEntry, loadBatchVideos } from '../../utilities/media-utils';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';
import CopyDialog from '../copy-dialog/CopyDialog';
import ShareUserDialog from '../share-user-dialog/ShareUserDialog';
import { MediaMetaData } from '../../models/media-meta-data';
import { trackPromise } from 'react-promise-tracker';
import { IDBPDatabase } from 'idb';
import { UpdateProgressCallback, VideosLoadedCallback } from '../../models/callbacks';
import { UserSession } from 'blockstack';
import { ShareUserEntry } from '../../models/share-user-entry';
import AddToPlaylistDialog from '../playlists/AddToPlaylistDialog';
import { CacheResults } from '../../models/cache-entry';
import PublishIcon from '@material-ui/icons/Publish';

const ITEM_HEIGHT = 54;
const MAX_MORE = 12;
const batchSize = 4;

interface BrowseVideosProps {
    videos: BrowseEntry[];
    videosLoadedCallback: VideosLoadedCallback;
    db?: IDBPDatabase<unknown> | null | undefined;
    worker: Worker | null;
    updateProgressCallback: UpdateProgressCallback;
    isMobile: boolean;
    searchText: string;
    mediaType: string;
}

export function BrowseVideos(props: BrowseVideosProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const history = useHistory();
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [copyOpen, setCopyOpen] = React.useState(false);
    const [shareUserOpen, setShareUserOpen] = React.useState(false);
    const [shareUsers, setShareUsers] = React.useState<Array<string>>([]);
    const [unshare, setUnshare] = React.useState(false);
    const [menuBrowseEntry, setMenuBrowseEntry] = React.useState<BrowseEntry | null>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [cacheResults, setCacheResults] = React.useState<CacheResults | null>(null);
    const [selectedFriends, setSelectedFriends] = React.useState<Array<string> | null | undefined>([]);
    const [selectedPlaylist, setSelectedPlaylist] = React.useState<string | null>(null);
    const [addToPlaylistOpen, setAddToPlaylistOpen] = React.useState(false);
    const [noResults, setNoResults] = React.useState(false);

    const db = props.db;
    const worker = props.worker;
    const videosLoadedCallback = props.videosLoadedCallback;
    const videos = props.videos;

    useEffect(() => {

        const refresh = async () => {
            let arr: BrowseEntry[] = [];
            if (worker && db && props.mediaType && userSession?.isUserSignedIn()) {
                setLoadingMore(true);
                try {
                    let moreCacheResults;
                    if (props.searchText && props.searchText.trim().length > 0) {
                        moreCacheResults = await getCacheEntriesFromSearch(db, props.mediaType, props.searchText, MAX_MORE, null);
                    }
                    else {
                        let sp = await getSelectedGroup(userSession);
                        if (sp) {
                            moreCacheResults = await getCacheEntriesFromGroup(userSession, db, props.mediaType, worker, sp, MAX_MORE, null);
                        }
                        else {
                            let sf = await getSelectedShares(userSession);
                            setSelectedFriends(sf);
                            moreCacheResults = await getCacheEntries(userSession, db, props.mediaType, MAX_MORE, null, sf);
                        }
                        setSelectedPlaylist(sp);
                    }
                    if (moreCacheResults.cacheEntries?.length > 0) {
                        setNoResults(false);
                        for (let i = 0; i < moreCacheResults.cacheEntries?.length; i += batchSize) {
                            if (i === 0) {
                                await trackPromise(loadBatchVideos(userSession, i, moreCacheResults.cacheEntries, arr, batchSize, videosLoadedCallback));
                            }
                            else {
                                await loadBatchVideos(userSession, i, moreCacheResults.cacheEntries, arr, batchSize, videosLoadedCallback);
                            }
                        }
                        if (moreCacheResults.nextKey && moreCacheResults.nextPrimaryKey) {
                            setCacheResults(moreCacheResults);
                        }
                        else {
                            setCacheResults(null);
                        }
                    }
                    else {
                        setNoResults(true);
                    }
                }
                finally {
                    setLoadingMore(false)
                }

            }
        }
        const setContext = async () => {
            if (worker && db && props.mediaType && userSession?.isUserSignedIn()) {
                if (!props.searchText || props.searchText.trim().length === 0) {
                    let sp = await getSelectedGroup(userSession);
                    if (!sp) {
                        let sf = await getSelectedShares(userSession);
                        setSelectedFriends(sf);
                    }
                    setSelectedPlaylist(sp);
                }
            }
        }

        if (videos.length === 0) {
            refresh();
        }
        else {
            setContext();
        }
    }, [userSession, db, videos, videosLoadedCallback, worker, props.searchText, props.mediaType]);

    const loadMore = async () => {
        if (userSession && props.db && cacheResults && cacheResults.nextKey && cacheResults.nextPrimaryKey) {
            setLoadingMore(true);
            try {
                let arr: BrowseEntry[] = props.videos;
                let moreCacheResults;
                if (props.searchText && props.searchText.trim().length > 0) {
                    moreCacheResults = await getCacheEntriesFromSearch(props.db, props.mediaType, props.searchText, MAX_MORE, cacheResults);
                }
                else if (selectedPlaylist) {
                    moreCacheResults = await getCacheEntriesFromGroup(userSession, props.db, props.mediaType, props.worker, selectedPlaylist, MAX_MORE, cacheResults);
                }
                else {
                    moreCacheResults = await getCacheEntries(userSession, props.db, props.mediaType, MAX_MORE, cacheResults, selectedFriends);
                }
                if (moreCacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < moreCacheResults.cacheEntries?.length; i += 1) {
                        await loadBatchVideos(userSession, i, moreCacheResults.cacheEntries, arr, 1, videosLoadedCallback);
                    }
                }
                if (moreCacheResults.nextKey && moreCacheResults.nextPrimaryKey) {
                    setCacheResults(moreCacheResults);
                }
                else {
                    setCacheResults(null);
                }

            }
            finally {
                setLoadingMore(false);
            }
        }
    }

    const deleteVideo = async (metaData: MediaMetaData, userSession: UserSession | undefined) => {
        if (userSession) {
            await deleteVideoEntry(metaData, userSession, props.worker, props.updateProgressCallback);
            for (let i = 0; i < props.videos.length; i++) {
                if (props.videos[i].metaData.id === metaData.id) {
                    let newVideos = videos.slice();
                    newVideos.splice(i, 1);
                    props.videosLoadedCallback(newVideos);
                    break;
                }
            }
        }
    }

    const deleteConfirmResult = (item: any, result: boolean) => {
        setConfirmOpen(false);
        if (result) {
            let metaData: MediaMetaData = item as MediaMetaData;
            if (metaData) {
                trackPromise(deleteVideo(metaData, userSession))
            }
        }
    }

    const copyResult = () => {
        setCopyOpen(false);
    }

    const shareUserResult = (item: MediaMetaData, unshare: boolean, result: ShareUserEntry[] | undefined) => {
        setShareUserOpen(false);
        if (userSession && result && result.length > 0) {
            trackPromise(shareFile([item], userSession, result, unshare));
        }
    }

    const addToPlaylistResult = (item: MediaMetaData, result: string[] | undefined) => {
        setAddToPlaylistOpen(false);
        if (userSession && result && result.length > 0) {
            trackPromise(addToGroup([item], userSession, result));
        }
    }

    const navVideo = (browseEntry: BrowseEntry) => {
        let user = '';
        if (browseEntry.metaData.userName) {
            user = `/${browseEntry.metaData.userName}`;
        }
        const access = browseEntry.metaData.isPublic ? "public" : "private";
        let url = `/videos/show/${access}/${browseEntry.metaData.type}/${browseEntry.metaData.id}${user}?height=${browseEntry.actualHeight}&width=${browseEntry.actualWidth}`;
        if (selectedPlaylist) {
            url = `${url}&playlist=${selectedPlaylist}`;
        }
        history.push(url);
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>, browseEntry: BrowseEntry) => {
        setMenuBrowseEntry(browseEntry);
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const removeVideoFromGroup = async () => {
        if (menuBrowseEntry && userSession?.isUserSignedIn() && selectedPlaylist) {
            let found: number = -1;
            for (let i = 0; i < videos?.length; i++) {
                if (videos[i].metaData.id === menuBrowseEntry.metaData.id) {
                    found = i;
                    break;
                }
            }
            await removeFromGroup([menuBrowseEntry.metaData], userSession, selectedPlaylist)
            if (found >= 0) {
                let newVideos = videos.slice();
                newVideos.splice(found, 1);
                videosLoadedCallback(newVideos);
            }
        }
    }

    const handleShare = async (isUnshare: boolean) => {
        if (userSession?.isUserSignedIn() && menuBrowseEntry) {
            let friends = await getShares(userSession);
            if (friends) {
                const users: string[] = []
                for (let key in friends) {
                    let canAdd = true;
                    if (isUnshare) {
                        const isShared = await isFileShared(userSession, key, menuBrowseEntry.metaData);
                        if (!isShared) {
                            canAdd = false;
                        }
                    }
                    if (canAdd) {
                        users.push(key);
                    }
                }
                setUnshare(isUnshare);
                setShareUsers(users);
                setShareUserOpen(true);
            }
        }
    }

    const handleMenu = async (option: string) => {
        if (option === 'Delete') {
            if (menuBrowseEntry) {
                setConfirmOpen(true);
            }
        }
        else if (option === 'Edit') {
            if (menuBrowseEntry) {
                history.push(`/publish/${menuBrowseEntry.metaData.type}/${menuBrowseEntry.metaData.id}`);
            }
        }
        else if (option === 'Share' || option === 'Unshare') {
            if (menuBrowseEntry?.metaData?.isPublic) {
                setCopyOpen(true);
            }
            else {
                trackPromise(handleShare(option === 'Unshare'));
            }
        }
        else if (option === 'Add to playlist') {
            setAddToPlaylistOpen(true);
        }
        else if (option === 'Remove from playlist'
            && menuBrowseEntry
            && userSession?.isUserSignedIn()
            && selectedPlaylist) {
            trackPromise(removeVideoFromGroup())
        }
        handleClose();
    };

    const getOptions = () => {
        let options: string[] = [];
        if (menuBrowseEntry) {
            if (!menuBrowseEntry.fromShare) {
                if (menuBrowseEntry.metaData.isPublic) {
                    options = ['Share', 'Edit', 'Delete'];
                }
                else {
                    options = ['Share', 'Unshare', 'Edit', 'Delete'];
                }
            }

            if (selectedPlaylist) {
                options.push('Remove from playlist');
            }
            else {
                options.push('Add to playlist');
            }
        }

        return options;
    }

    const canLoadMore = () => {
        if (props.videos.length >= MAX_MORE && cacheResults) {
            return true;
        }
        return false;
    }

    const getPublicVideoUrl = async () => {
        if (copyOpen && userSession?.isUserSignedIn() && menuBrowseEntry && menuBrowseEntry.metaData.isPublic) {
            let userData = userSession.loadUserData();
            let userName: string | undefined = undefined;
            if (menuBrowseEntry && menuBrowseEntry.metaData.userName && menuBrowseEntry.metaData.userName !== userData.username) {
                userName = menuBrowseEntry.metaData.userName;
            }
            let source = await userSession.getFileUrl(``, {
                username: userName
            });
            if (source) {
                const url = new URL(source);
                source = `${window.location.origin}/#/videoplayer/public/${menuBrowseEntry.metaData.type}/${url.hostname}/${menuBrowseEntry.metaData.id}?path=${url.pathname}&height=${menuBrowseEntry.actualHeight}&width=${menuBrowseEntry.actualWidth}`
                console.log(source);
            }
            return source;

        }
        return ''
    }

    const getImageSrc = (browseEntry: BrowseEntry) => {
        if (browseEntry.previewImage === "music.png") {
            return "music.png"
        }
        else {
            return `data:image/png;base64, ${browseEntry.previewImage}`
        }
    }

    return (
        <Fragment>
            {(props.videos && props.videos.length > 0) &&
                <div>
                    <ShareUserDialog open={shareUserOpen} metaData={menuBrowseEntry?.metaData ?? null} initialUsers={shareUsers} unshare={unshare} shareUsersResult={shareUserResult} />
                    <AddToPlaylistDialog open={addToPlaylistOpen} metaData={menuBrowseEntry?.metaData ?? null} result={addToPlaylistResult} />
                    <ConfirmDialog open={confirmOpen} item={menuBrowseEntry?.metaData ?? null} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete ${menuBrowseEntry?.metaData?.title}?`} />
                    <CopyDialog open={copyOpen} onResult={copyResult} title="Copy Link" getTextCallback={getPublicVideoUrl} />

                    <Toolbar style={{ flexWrap: 'wrap', justifyContent: 'space-around' }}>
                        {props.videos.map(x => (
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}} key={x.metaData.id}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: props.mediaType === 'music' ? 192 : 331.734,
                                        height: props.mediaType === 'music' ? 192 : 173.641,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }} onClick={() => { navVideo(x); }}>
                                    <img
                                        style={{ marginLeft: 'auto', marginRight: 'auto' }}
                                        width={x.previewImageWidth}
                                        height={x.previewImageHeight}
                                        id={x.metaData.id}
                                        alt={x.metaData.title}
                                        src={getImageSrc(x)} />
                                </div>
                                <Toolbar style={{ paddingLeft: 5, justifyContent: 'space-between' }} disableGutters={true}>
                                    <div onClick={() => { navVideo(x) }}>
                                        <Typography variant="caption">{`${x.metaData?.title} (${x.age})`}</Typography>
                                    </div>
                                    <div>
                                        <IconButton
                                            style={{ minWidth: 30, outline: 'none', paddingTop: 0, paddingBottom: 0, paddingLeft: 5, paddingRight: 5 }}
                                            onClick={(e) => handleClick(e, x)}
                                        >
                                            <MoreVertIcon />
                                        </IconButton>
                                        <Menu
                                            id="video-actions"
                                            anchorEl={anchorEl}
                                            keepMounted
                                            open={open}
                                            onClose={handleClose}
                                            PaperProps={{
                                                style: {
                                                    maxHeight: ITEM_HEIGHT * 4.5,
                                                    width: '22ch'
                                                },
                                            }}
                                        >
                                            {getOptions().map((option) => (
                                                <MenuItem key={option} selected={option === 'Edit'} onClick={() => handleMenu(option)}>
                                                    {option}
                                                </MenuItem>
                                            ))}
                                        </Menu>
                                    </div>
                                </Toolbar>
                            </div>
                        ))}
                    </Toolbar>
                    {canLoadMore() &&
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Button disabled={loadingMore} onClick={loadMore}>Show More</Button>
                        </div>
                    }
                </div>
            }
            {(noResults) &&
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', paddingLeft: !props.isMobile ? 20 : 0, height: '80vh', width: 'calc(100%-20)' }}>
                    <div style={{ width: '100%', textAlign: 'center' }}>
                        <Typography variant="h5">
                            <IconButton color="primary" onClick={() => { history.push('/publish') }}><PublishIcon />Upload</IconButton>
                        </Typography>
                        <Typography variant="h5">No Results Found.</Typography>
                    </div>
                </div>
            }
        </Fragment>
    );
}
