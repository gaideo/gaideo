import React, { useEffect, Fragment } from 'react';
import { useConnect } from '@blockstack/connect';
import { Toolbar, Typography, IconButton, Menu, Button } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import "./BrowseVideos.css";
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useHistory } from 'react-router-dom';
import { getCacheEntries, getShares, shareFile, getSelectedShares } from '../../utilities/gaia-utils';
import { loadBrowseEntryFromCache, deleteVideoEntry, VideosType } from '../../utilities/media-utils';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';
import ShareUserDialog from '../share-user-dialog/ShareUserDialog';
import { MediaMetaData } from '../../models/media-meta-data';
import { trackPromise } from 'react-promise-tracker';
import { IDBPDatabase } from 'idb';
import { UpdateProgressCallback, VideosLoadedCallback } from '../../models/callbacks';
import { UserSession } from 'blockstack';
import { getImageSize } from '../../utilities/image-utils';
import { ShareUserEntry } from '../../models/share-user-entry';

const options = [
    'Share',
    'Edit',
    'Delete'
];

const ITEM_HEIGHT = 48;

interface BrowseVideosProps {
    videos: BrowseEntry[];
    videosLoadedCallback: VideosLoadedCallback;
    db?: IDBPDatabase<unknown> | null | undefined;
    worker: Worker | null;
    updateProgressCallback: UpdateProgressCallback;
}

export function BrowseVideos(props: BrowseVideosProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const history = useHistory();
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [shareUserOpen, setShareUserOpen] = React.useState(false);
    const [shareUsers, setShareUsers] = React.useState<Array<string>>([]);
    const [menuMetaData, setMenuMetaData] = React.useState<MediaMetaData | null>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [lastCacheKeys, setLastCacheKeys] = React.useState<IDBValidKey[] | null>(null);
    const [selectedFriends, setSelectedFriends] = React.useState<Array<string> | null | undefined>([]);

    const MAX_MORE = 12;

    const db = props.db;
    const videosLoadedCallback = props.videosLoadedCallback;
    const videos = props.videos;

    useEffect(() => {
        const refresh = async () => {
            console.log('hello');

            let arr: BrowseEntry[] = [];
            if (db && userSession?.isUserSignedIn()) {
                let sf = await getSelectedShares(userSession);
                setSelectedFriends(sf);
                let cacheResults = await getCacheEntries(userSession, db, VideosType, MAX_MORE, null, sf);
                if (cacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < cacheResults.cacheEntries?.length; i++) {
                        let decryptedData = await userSession.decryptContent(cacheResults.cacheEntries[i].data) as string;
                        if (decryptedData) {
                            let metaData = JSON.parse(decryptedData);
                            let be = await loadBrowseEntryFromCache(userSession, metaData, true) as BrowseEntry;
                            if (be) {
                                let img = new Image();
                                let src = `data:image/png;base64, ${be.previewImage}`;
                                img.onload = ev => {
                                    const size = getImageSize(img.width, img.height, 400, 200);
                                    be.previewImageWidth = size[0];
                                    be.previewImageHeight = size[1];
                                    be.actualHeight = img.height;
                                    be.actualWidth = img.width;
                                    arr.push(be);
                                    videosLoadedCallback(arr.slice())
                                };
                                img.src = src;

                            }
                        }
                    }
                    if (cacheResults.nextKey && cacheResults.nextPrimaryKey) {
                        setLastCacheKeys([cacheResults.nextKey, cacheResults.nextPrimaryKey]);
                    }
                }
            }
        }
        if (videos.length === 0) {
            refresh();
        }
    }, [userSession, db, videos, videosLoadedCallback]);

    const loadMore = async () => {
        if (userSession && props.db && lastCacheKeys && lastCacheKeys?.length > 0) {
            setLoadingMore(true);
            try {
                let arr: BrowseEntry[] = props.videos;
                let cacheResults = await getCacheEntries(userSession, props.db, VideosType, MAX_MORE, lastCacheKeys, selectedFriends);
                if (cacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < cacheResults.cacheEntries?.length; i++) {
                        let decryptedData = await userSession.decryptContent(cacheResults.cacheEntries[i].data) as string;
                        if (decryptedData) {
                            let metaData = JSON.parse(decryptedData);
                            let be = await loadBrowseEntryFromCache(userSession, metaData, true) as BrowseEntry
                            if (be) {
                                let img = new Image();
                                let src = `data:image/png;base64, ${be.previewImage}`;
                                img.onload = ev => {
                                    const size = getImageSize(img.width, img.height, 330, 183);
                                    be.previewImageWidth = size[0];
                                    be.previewImageHeight = size[1];
                                    arr.push(be);
                                    props.videosLoadedCallback(arr.slice())
                                };
                                img.src = src;
                            }
                        }
                    }
                    if (cacheResults.nextKey && cacheResults.nextPrimaryKey) {
                        setLastCacheKeys([cacheResults.nextKey, cacheResults.nextPrimaryKey]);
                    }
                    else {
                        setLastCacheKeys(null);
                    }
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
        }
    }

    const deleteConfirmResult = (item: any, result: boolean) => {
        setConfirmOpen(false);
        if (result) {
            let metaData: MediaMetaData = item as MediaMetaData;
            if (metaData) {
                trackPromise(deleteVideo(metaData, userSession).then(x => { history.go(0) }))
            }
        }
    }

    const shareUserResult = (item: MediaMetaData, result: ShareUserEntry[] | undefined) => {
        setShareUserOpen(false);
        if (userSession && result && result.length > 0) {
            trackPromise(shareFile([item], userSession, result));
        }
    }

    const navVideo = (browseEntry: BrowseEntry) => {
        let user = '';
        if (browseEntry.metaData.userName) {
            user = `/${browseEntry.metaData.userName}`;
        }
        history.push(`/videos/show/${browseEntry.metaData.id}${user}?height=${browseEntry.actualHeight}&width=${browseEntry.actualWidth}`)
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>, metaData: MediaMetaData) => {
        setMenuMetaData(metaData);
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const handleMenu = async (option: string) => {
        if (option === 'Delete') {
            if (menuMetaData) {
                setConfirmOpen(true);
            }
        }
        else if (option === 'Edit') {
            if (menuMetaData) {
                history.push(`/publish/${menuMetaData.id}`);
            }
        }
        else if (option === 'Share') {
            let friends = await getShares(userSession);
            if (friends) {
                const users: string[] = []
                for (let key in friends) {
                    users.push(key);
                }
                setShareUsers(users);
                setShareUserOpen(true);
            }
        }
        handleClose();
    };

    return (
        <Fragment>
            <ShareUserDialog open={shareUserOpen} metaData={menuMetaData} initialUsers={shareUsers} shareUsersResult={shareUserResult} />
            <ConfirmDialog open={confirmOpen} item={menuMetaData} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete ${menuMetaData?.title}?`} />
            <Toolbar style={{ flexWrap: 'wrap', justifyContent: 'space-around' }}>
                {props.videos.map(x => (
                    <div key={x.metaData.id}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                width: 331.734,
                                height: 173.641,
                                overflow: 'hidden',
                                background: 'black',
                                cursor: 'pointer',
                            }} onClick={() => { navVideo(x); }}>
                            <img
                                style={{ marginLeft: 'auto', marginRight: 'auto' }}
                                width={x.previewImageWidth}
                                height={x.previewImageHeight}
                                id={x.metaData.id}
                                alt={x.metaData.title}
                                src={`data:image/png;base64, ${x.previewImage}`} />
                        </div>
                        <Toolbar style={{ justifyContent: 'space-between' }} disableGutters={true}>
                            <div onClick={() => { navVideo(x) }}>
                                <Typography variant="caption">{`${x.metaData?.title} (${x.age})`}</Typography>
                            </div>
                            {!x.fromShare &&
                                <div>
                                    <IconButton
                                        style={{ minWidth: 30, outline: 'none', paddingTop: 0, paddingBottom: 0, paddingLeft: 5, paddingRight: 5 }}
                                        onClick={(e) => handleClick(e, x.metaData)}
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
                                                width: '20ch',
                                            },
                                        }}
                                    >
                                        {options.map((option) => (
                                            <MenuItem key={option} selected={option === 'Edit'} onClick={() => handleMenu(option)}>
                                                {option}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                </div>
                            }
                        </Toolbar>
                    </div>
                ))}
            </Toolbar>
            {props.videos.length >= MAX_MORE &&
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Button disabled={loadingMore} onClick={loadMore}>Show More</Button>
                </div>
            }
        </Fragment>
    );
}
