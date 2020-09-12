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
import { MediaEntry, MediaType } from '../../models/media-entry';
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
    const [menuMediaEntry, setMenuMediaEntry] = React.useState<MediaEntry | null>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    useEffect(() => {

        const refresh = async () => {
            const indexes: string[] = [];
            let arr: BrowseEntry[] = [];
/*            let deleteme: string[] = [];
            await userSession?.listFiles((name: string) => {
                deleteme.push(name);
                return true;
            });
            for (let i=0; i<deleteme.length; i++) {
                await userSession?.deleteFile(deleteme[i], {
                    wasSigned: false
                })
            }*/
            userSession?.listFiles((name: string) => {
                if (name.startsWith("videos/")
                    && name.endsWith(".index")) {
                    indexes.push(name);
                    loadBrowseEntry(userSession, name, true, MediaType.Video).then((x: any) => {
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
            let mediaEntry: MediaEntry = item as MediaEntry;
            if (mediaEntry) {
                trackPromise(deleteVideoEntry(mediaEntry, userSession).then(x => { history.go(0) }))
            }
        }
    }

    const navVideo = (browseEntry: BrowseEntry) => {
        history.push(`/videos/show/${browseEntry.mediaEntry.id}`)
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>, mediaEntry: MediaEntry) => {
        setMenuMediaEntry(mediaEntry);
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const handleMenu = (option: string) => {
        if (option === 'Delete') {
            if (menuMediaEntry) {
                setConfirmOpen(true);
            }
        }
        if (option === 'Edit') {
            if (menuMediaEntry) {
                history.push(`/publish/${menuMediaEntry.id}`);
            }
        }
        handleClose();
    };

    return (
        <Fragment>
            <ConfirmDialog open={confirmOpen} item={menuMediaEntry} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete ${menuMediaEntry?.title}?`} />
            <Toolbar style={{ flexWrap: 'wrap' }}>
                {browseEntries.map(x => (
                    <div key={x.mediaEntry.id}>
                        <div style={{ width: 331, height: 200, cursor: 'pointer' }} onClick={() => { navVideo(x); }}>
                            <img id={x.mediaEntry.id} alt={x.mediaEntry.title} src={`data:image/png;base64, ${x.previewImage}`} />
                        </div>
                        <Toolbar style={{ justifyContent: 'space-between' }}>
                            <div onClick={() => { navVideo(x) }}>
                                <Typography variant="caption">{`${x.mediaEntry?.title} (${x.age})`}</Typography>
                            </div>
                            <div>
                                <IconButton
                                    style={{ minWidth: 30, outline: 'none' }}
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
        </Fragment>
    );
}