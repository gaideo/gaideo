import React, { Fragment, useCallback, useEffect, useState } from 'react';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import AsyncSelect from 'react-select/async';
import makeAnimated from 'react-select/animated';
import { IconButton } from '@material-ui/core';
import { getGroup, getGroups, getSelectedGroup, saveGroupIndex, updateGroup, defaultMaxSort, getShares, shareGroupIndex, getSharedGroups, isFileShared, createHashAddress, SharedGroupType, unshareGroupIndex } from '../../utilities/gaia-utils';
import { useConnect } from '@blockstack/connect';
import { trackPromise } from 'react-promise-tracker';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';
import { Group } from '../../models/group';
import AddPlaylistDialog from './AddPlaylistDialog';
import { IDBPDatabase } from 'idb';
import { EditPlaylistEntry } from '../../models/edit-playlist-entry';
import ShareUserDialog from '../share-user-dialog/ShareUserDialog';
import { MediaMetaData } from '../../models/media-meta-data';
import { ShareUserEntry } from '../../models/share-user-entry';
import { SpeedDial, SpeedDialAction } from '@material-ui/lab';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import "./Playlist.css";

interface ShowCallback {
    (show: boolean): void
}

interface SaveSelectedPlaylistCallback {
    (selected: string | null, userName?: string): void
}

interface PlaylistsProps {
    show: boolean;
    showCallback: ShowCallback;
    isMobile: boolean;
    saveSelectedPlaylistCallback: SaveSelectedPlaylistCallback;
    worker: Worker | null;
    db?: IDBPDatabase<unknown> | null | undefined;
}

export function Playlists(props: PlaylistsProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;

    const [openAdd, setOpenAdd] = useState(false);
    const [editID, setEditID] = useState('');
    const [confirmDeletePlaylistOpen, setConfirmDeletePlaylistOpen] = React.useState(false);
    const [playlists, setPlaylists] = useState(new Array<Group>());
    const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
    const [shareUserOpen, setShareUserOpen] = React.useState(false);
    const [shareUsers, setShareUsers] = React.useState<Array<string>>([]);
    const [open, setOpen] = React.useState(false);
    const [unshare, setUnshare] = React.useState(false);

    useEffect(() => {
        const refresh = async () => {
            if (userSession?.isUserSignedIn()) {
                let selected = await getSelectedGroup(userSession);
                if (selected) {
                    const group = await getGroup(userSession, selected) as Group;
                    if (group) {
                        setSelectedPlaylist({
                            value: group.id,
                            label: group.name
                        })
                    }
                    else {
                        setSelectedPlaylist(null);
                    }
                }
                else {
                    setSelectedPlaylist(null);
                }
            }
        }
        refresh();
    }, [userSession]);
    const handleAddPlaylistOpen = () => {
        setOpenAdd(true);
    };

    const handleEditPlaylistOpen = () => {
        if (selectedPlaylist) {
            setEditID(selectedPlaylist.value)
            setOpenAdd(true);
        }
    };

    const handleDeletePlaylist = () => {
        if (selectedPlaylist) {
            setConfirmDeletePlaylistOpen(true);
        }
    };
    const handlePlaylistsHide = () => {
        props.showCallback(false);
    };

    const handleChanged = (newValue: any) => {
        setSelectedPlaylist(newValue);
        if (newValue && newValue.value) {
            props.saveSelectedPlaylistCallback(newValue.value, newValue.userName);
        }
        else {
            props.saveSelectedPlaylistCallback(null);
        }
    }

    const saveSelectedPlaylistCallback = props.saveSelectedPlaylistCallback;

    const updatePlaylistCallback = useCallback(async (playlist: Group, deleteFlag: boolean, id: string | undefined, entries: EditPlaylistEntry[] | undefined) => {
        if (userSession?.isUserSignedIn()) {
            await updateGroup(userSession, playlist, deleteFlag);
            let updated = await getGroups(userSession);
            if (updated) {
                const list: any[] = [];
                for (let key in updated) {
                    const group = updated[key] as Group;
                    list.push({
                        value: group.id,
                        label: group.name
                    });
                }
                setPlaylists(list);
            }
            else {
                setPlaylists(new Array<Group>());
            }
            if (deleteFlag) {
                setSelectedPlaylist(null);
                saveSelectedPlaylistCallback(null);
            }
            else if (id) {
                setSelectedPlaylist({
                    ...selectedPlaylist, label: playlist.name
                })
                let groupIndex: any = {

                };
                if (entries) {
                    for (let i = 0; i < entries.length; i++) {
                        let sort = `${i}`;
                        let padLength = (defaultMaxSort.length - sort.length);
                        let pad = '';
                        for (let j = 0; j < padLength; j++) {
                            pad += '0';
                        }
                        groupIndex[entries[i].indexFile] = `${entries[i].userName},${pad}${i}`;
                    }
                }
                await saveGroupIndex(userSession, playlist.id, groupIndex);
            }
        }

    }, [userSession, selectedPlaylist, saveSelectedPlaylistCallback])

    const setAddPlaylistDialogOpenCallback = useCallback((open: boolean, playlist: Group | null, editID: string | undefined, entries: EditPlaylistEntry[] | undefined) => {
        setOpenAdd(open);
        if (!open
            && playlist
            && userSession?.isUserSignedIn()) {
            trackPromise(updatePlaylistCallback(playlist, false, editID, entries));
        }

    }, [userSession, updatePlaylistCallback]);

    const filterPlaylists = async (inputValue: string) => {
        let options: any[] = [];
        if (userSession?.isUserSignedIn()) {
            let playlists: any = await getGroups(userSession);
            for (let key in playlists) {
                let entry = playlists[key];
                if (!inputValue || (inputValue.length > 0 && entry.name.startsWith(inputValue))) {
                    options.push({
                        value: entry.id,
                        label: entry.name
                    });
                }
            }
            if (props.db) {
                let sharedGroups = await getSharedGroups(userSession, props.db);
                if (sharedGroups && sharedGroups.length > 0) {
                    sharedGroups.forEach(x => {
                        options.push({
                            value: x.id,
                            label: `${x.title} (${x.userName})`,
                            userName: x.userName
                        })
                    })
                }
            }
            options.sort((x, y) => {
                if (!x && y) {
                    return -1;
                }
                else if (x && !y) {
                    return 1;
                }
                else if (x.label < y.label) {
                    return -1;
                }
                else if (x.label > y.label) {
                    return 1;
                }
                else {
                    return 0;
                }
            })
        }
        return options;
    }

    const animatedComponents = makeAnimated();

    const deleteConfirmResult = (item: any, result: boolean) => {
        setConfirmDeletePlaylistOpen(false);
        if (result) {
            if (item && item.value && item.label) {
                const playlist: Group = {
                    id: item.value,
                    name: item.label
                }
                if (userSession?.isUserSignedIn() && playlist) {
                    setSelectedPlaylist(null);
                    trackPromise(updatePlaylistCallback(playlist, true, undefined, undefined));
                }
            }
        }
    }

    const handleShare = async (isUnshare: boolean) => {
        if (userSession?.isUserSignedIn() && selectedPlaylist) {
            let friends = await getShares(userSession);
            if (friends) {
                const users: string[] = []
                for (let key in friends) {
                    let canAdd = true;
                    if (isUnshare) {
                        let id = createHashAddress([selectedPlaylist.value])
                        const isShared = await isFileShared(userSession, key, id, SharedGroupType);
                        if (!isShared) {
                            canAdd = false;
                        }
                    }
                    if (canAdd) {
                        users.push(key);
                    }
                }
                setUnshare(isUnshare)
                setShareUsers(users);
                setShareUserOpen(true);
            }
        }
    }

    const shareUserResult = (item: MediaMetaData | null, unshare: boolean, result: ShareUserEntry[] | undefined) => {
        setShareUserOpen(false);
        if (userSession && result && result.length > 0 && selectedPlaylist) {
            if (unshare) {
                trackPromise(unshareGroupIndex(userSession, selectedPlaylist.value, result, props.worker));
            }
            else {
                trackPromise(shareGroupIndex(userSession, selectedPlaylist.value, result, props.worker));
            }
        }
    }

    const handleClose = () => {
        setOpen(false);
    };

    const handleOpen = (event: any) => {
        if (event.type !== "focus") {
            setOpen(true);
        }
    };

    const handleAction = (action: any) => {
        handleClose();
        if (action.name === 'Add') {
            handleAddPlaylistOpen();
        }
        else if (action.name === 'Edit') {
            handleEditPlaylistOpen();
        }
        else if (action.name === 'Share') {
            handleShare(false);
        }
        else if (action.name === 'Unshare') {
            handleShare(true);
        }
        else if (action.name === 'Delete') {
            handleDeletePlaylist();
        }
    }

    const getActions = () => {
        const actions = [
            { icon: <AddIcon />, name: 'Add' }
        ];
        if (selectedPlaylist && !selectedPlaylist.userName) {
            actions.push({ icon: <EditIcon />, name: 'Edit' });
            actions.push({ icon: <ScreenShareIcon />, name: 'Share' })
            actions.push({ icon: <StopScreenShareIcon />, name: 'Unshare' })
        }
        actions.push({ icon: <DeleteIcon />, name: 'Delete' })
        return actions;
    }

    return (
        <div style={{ paddingTop: props.show ? 30 : 0, paddingLeft: !props.isMobile ? 22 : 0 }}>
            {props.show &&
                <Fragment>
                    <ConfirmDialog open={confirmDeletePlaylistOpen} item={selectedPlaylist} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete the selected playlist?`} />
                    <AddPlaylistDialog open={openAdd} id={editID} setAddPlaylistDialogOpenCallback={setAddPlaylistDialogOpenCallback} db={props.db} />
                    <ShareUserDialog open={shareUserOpen} metaData={null} initialUsers={shareUsers} unshare={unshare} shareUsersResult={shareUserResult} />
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <div style={{ flex: '1 1 auto' }}>
                            <AsyncSelect
                                key={JSON.stringify(playlists)}
                                value={selectedPlaylist}
                                placeholder="Choose playlist..."
                                cacheOptions
                                defaultOptions
                                isClearable={true}
                                loadOptions={filterPlaylists}
                                components={animatedComponents}
                                onChange={(newValue, actionMeta) => { handleChanged(newValue) }} />
                        </div>
                        <div style={{ width: 40 }}>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <SpeedDial
                                ariaLabel="SpeedDial example"
                                style={{ left: -43, position: 'absolute' }}
                                icon={<MoreVertIcon />}
                                onClose={handleClose}
                                onOpen={handleOpen}
                                open={open}
                                direction={"down"}>
                                {getActions().map((action) => (
                                    <SpeedDialAction
                                        key={action.name}
                                        icon={action.icon}
                                        tooltipTitle={action.name}
                                        onClick={() => handleAction(action)}
                                    />
                                ))}
                            </SpeedDial>
                        </div>
                        <div className={'close-button'} onClick={handlePlaylistsHide} style={{ cursor: 'pointer', padding: 0 }}>
                            <IconButton style={{ minWidth: 30, outline: 'none', padding: 0 }}>
                                <CloseIcon />
                            </IconButton>
                        </div>
                    </div>
                </Fragment>
            }
        </div>
    );

}
