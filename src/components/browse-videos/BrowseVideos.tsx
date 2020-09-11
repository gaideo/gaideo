import React, { useEffect, Fragment } from 'react';
import { useConnect } from '@blockstack/connect';
import { Toolbar, Typography, IconButton, Menu } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import "./BrowseVideos.css";
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useHistory } from 'react-router-dom';
import { loadBrowseEntry, deleteVideoEntry } from '../../utilities/data-utils';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';
import { VideoEntry } from '../../models/video-entry';
import { trackPromise } from 'react-promise-tracker';

const options = [
    'Share',
    'Edit',
    'Delete'
];

const ITEM_HEIGHT = 48;

export function BrowseVideos() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [browseEntries, setBrowseEntries] = React.useState(new Array<BrowseEntry>());
    const history = useHistory();
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    useEffect(() => {

        const refresh = async () => {
            const indexes: string[] = [];
            let arr: BrowseEntry[] = [];
            userSession?.listFiles((name: string) => {
                if (name.startsWith("videos/")
                    && name.endsWith(".index")) {
                    indexes.push(name);
                    loadBrowseEntry(userSession, name, true).then((x: any) => {
                        let be = x as BrowseEntry;
                        if (be) {
                            arr.push(be)
                            setBrowseEntries(arr.slice());
                        }
                    })
                    if (indexes.length >= 20) {
                        return false;
                    }
                }
                return true;
            })
        }
        refresh();
    }, [userSession, history]);

    const deleteConfirmResult = (item: any, result: boolean) => {
        setConfirmOpen(false);
        if (result) {
            let videoEntry: VideoEntry = item as VideoEntry;
            if (videoEntry) {
                trackPromise(deleteVideoEntry(videoEntry, userSession).then(x => { history.push("/") }))
            }
        }
    }

    const navVideo = (browseEntry: BrowseEntry) => {
        history.push(`/videos/show/${browseEntry.videoEntry.id}`)
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const handleMenu = (option: string, videoEntry: VideoEntry | null) => {
        if (option === 'Delete') {
            if (videoEntry) {
                console.log('open confirm');
                setConfirmOpen(true);
            }
        }
        if (option === 'Edit') {
            if (videoEntry) {
                history.push(`/publish/${videoEntry.id}`);
            }
        }
        handleClose();
    };

    return (
        <Fragment>
            <Toolbar style={{ flexWrap: 'wrap' }}>
                {browseEntries.map(x => (
                    <div key={x.videoEntry.id}>
                        <ConfirmDialog open={confirmOpen} item={x.videoEntry} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete ${x.videoEntry.title}?`} />
                        <div style={{ width: 331, height: 200, cursor: 'pointer' }} onClick={() => { navVideo(x); }}>
                            <img id={x.videoEntry.id} alt={x.videoEntry.title} src={`data:image/png;base64, ${x.previewImage}`} />
                        </div>
                        <Toolbar style={{ justifyContent: 'space-between' }}>
                            <div onClick={() => { navVideo(x) }}>
                                <Typography variant="caption">{`${x.videoEntry?.title} (${x.age})`}</Typography>
                            </div>
                            <div>
                                <IconButton
                                    style={{ minWidth: 30, outline: 'none' }}
                                    onClick={handleClick}
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
                                        <MenuItem key={option} selected={option === 'Edit'} onClick={() => handleMenu(option, x.videoEntry)}>
                                            {option}
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </div>
                        </Toolbar>
                    </div>
                ))}
            </Toolbar>
        </Fragment>
    );
}
