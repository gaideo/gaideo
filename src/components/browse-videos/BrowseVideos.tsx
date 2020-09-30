import React, { useEffect, Fragment } from 'react';
import { useConnect } from '@blockstack/connect';
import { Toolbar, Typography, IconButton, Menu, Button } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import "./BrowseVideos.css";
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useHistory } from 'react-router-dom';
import { loadBrowseEntryFromCache, deleteVideoEntry, getCacheEntries, getFriends } from '../../utilities/data-utils';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';
import ShareUserDialog from '../share-user-dialog/ShareUserDialog';
import { MediaEntry, MediaType } from '../../models/media-entry';
import { trackPromise } from 'react-promise-tracker';
import { IDBPDatabase } from 'idb';
import { VideosLoadedCallback } from '../../models/callbacks';
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
}

export function BrowseVideos(props: BrowseVideosProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const history = useHistory();
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [shareUserOpen, setShareUserOpen] = React.useState(false);
    const [shareUsers, setShareUsers] = React.useState<Array<string>>([]);
    const [menuMediaEntry, setMenuMediaEntry] = React.useState<MediaEntry | null>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [lastCacheKeys, setLastCacheKeys] = React.useState<IDBValidKey[] | null>(null);
    const MAX_MORE = 12;

    useEffect(() => {

        const refresh = async () => {
            let arr: BrowseEntry[] = [];
            if (userSession && props.db) {
                let cacheResults = await getCacheEntries(userSession, props.db, MediaType.Video, MAX_MORE, null);
                if (cacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < cacheResults.cacheEntries?.length; i++) {
                        let decryptedData = await userSession.decryptContent(cacheResults.cacheEntries[i].data) as string;
                        if (decryptedData) {
                            let mediaEntry = JSON.parse(decryptedData);
                            let be = await loadBrowseEntryFromCache(userSession, mediaEntry, true) as BrowseEntry;
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
                                    props.videosLoadedCallback(arr.slice())
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
        if (props.videos.length === 0) {
            refresh();
        }
    }, [userSession, history, props]);

    const loadMore = async () => {
        if (userSession && props.db && lastCacheKeys && lastCacheKeys?.length > 0) {
            setLoadingMore(true);
            try {
                let arr: BrowseEntry[] = props.videos;
                let cacheResults = await getCacheEntries(userSession, props.db, MediaType.Video, MAX_MORE, lastCacheKeys);
                if (cacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < cacheResults.cacheEntries?.length; i++) {
                        let decryptedData = await userSession.decryptContent(cacheResults.cacheEntries[i].data) as string;
                        if (decryptedData) {
                            let mediaEntry = JSON.parse(decryptedData);
                            let be = await loadBrowseEntryFromCache(userSession, mediaEntry, true) as BrowseEntry
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

    const deleteVideo = async (mediaEntry: MediaEntry, userSession: UserSession | undefined) => {
        if (userSession) {
            await deleteVideoEntry(mediaEntry, userSession, props.worker);
        }
    }

    const deleteConfirmResult = (item: any, result: boolean) => {
        setConfirmOpen(false);
        if (result) {
            let mediaEntry: MediaEntry = item as MediaEntry;
            if (mediaEntry) {
                trackPromise(deleteVideo(mediaEntry, userSession).then(x => { history.go(0) }))
            }
        }
    }

    const shareUserResult = (result: ShareUserEntry[] | undefined) => {
        setShareUserOpen(false);
        if (result && result.length > 0) {
        }
    }

    const navVideo = (browseEntry: BrowseEntry) => {
        history.push(`/videos/show/${browseEntry.mediaEntry.id}?height=${browseEntry.actualHeight}&width=${browseEntry.actualWidth}`)
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>, mediaEntry: MediaEntry) => {
        setMenuMediaEntry(mediaEntry);
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const handleMenu = async (option: string) => {
        if (option === 'Delete') {
            if (menuMediaEntry) {
                setConfirmOpen(true);
            }
        }
        else if (option === 'Edit') {
            if (menuMediaEntry) {
                history.push(`/publish/${menuMediaEntry.id}`);
            }
        }
        else if (option === 'Share') {
            let friends = await getFriends(userSession);
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
            <ShareUserDialog open={shareUserOpen} initialUsers={shareUsers} shareUsersResult={shareUserResult}/>
            <ConfirmDialog open={confirmOpen} item={menuMediaEntry} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete ${menuMediaEntry?.title}?`} />
            <Toolbar style={{ flexWrap: 'wrap', justifyContent: 'space-around' }}>
                {props.videos.map(x => (
                    <div key={x.mediaEntry.id}>
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
                                id={x.mediaEntry.id}
                                alt={x.mediaEntry.title}
                                src={`data:image/png;base64, ${x.previewImage}`} />
                        </div>
                        <Toolbar style={{ justifyContent: 'space-between' }} disableGutters={true}>
                            <div onClick={() => { navVideo(x) }}>
                                <Typography variant="caption">{`${x.mediaEntry?.title} (${x.age})`}</Typography>
                            </div>
                            <div>
                                <IconButton
                                    style={{ minWidth: 30, outline: 'none', paddingTop: 0, paddingBottom: 0, paddingLeft: 5, paddingRight: 5 }}
                                    onClick={(e) => handleClick(e, x.mediaEntry)}
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
