import React, { Fragment, useCallback, useEffect, useState } from 'react';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import AsyncSelect from 'react-select/async';
import makeAnimated from 'react-select/animated';
import { Icon } from '@material-ui/core';
import { getGroup, getGroups, getSelectedGroup, saveGroupIndex, updateGroup, defaultMaxSort } from '../../utilities/gaia-utils';
import { useConnect } from '@blockstack/connect';
import { trackPromise } from 'react-promise-tracker';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';
import { Group } from '../../models/group';
import AddPlaylistDialog from './AddPlaylistDialog';
import { IDBPDatabase } from 'idb';
import { EditPlaylistEntry } from '../../models/edit-playlist-entry';


interface ShowCallback {
    (show: boolean): void
}

interface SaveSelectedPlaylistCallback {
    (selected: string | null): void
}

interface PlaylistsProps {
    show: boolean;
    showCallback: ShowCallback;
    isMobile: boolean;
    saveSelectedPlaylistCallback: SaveSelectedPlaylistCallback;
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
            props.saveSelectedPlaylistCallback(newValue.value);
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
                    for (let i=0; i<entries.length; i++) {
                        let sort = `${i}`;
                        let padLength = (defaultMaxSort.length - sort.length);
                        let pad = '';
                        for (let j=0; j<padLength; j++) {
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
        let playlists: any = await getGroups(userSession);
        let options: any[] = [];
        for (let key in playlists) {
            let entry = playlists[key];
            if (!inputValue || (inputValue.length > 0 && entry.name.startsWith(inputValue))) {
                options.push({
                    value: entry.id,
                    label: entry.name
                });
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
        return options;
    }
    const promiseOptions = (inputValue: string) =>
        new Promise(resolve => {
            resolve(filterPlaylists(inputValue));
        });

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

    return (
        <div style={{ paddingTop: props.show ? 30 : 0, paddingLeft: !props.isMobile ? 22 : 0 }}>
            {props.show &&
                <Fragment>
                    <ConfirmDialog open={confirmDeletePlaylistOpen} item={selectedPlaylist} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete the selected playlist?`} />
                    <AddPlaylistDialog open={openAdd} id={editID} setAddPlaylistDialogOpenCallback={setAddPlaylistDialogOpenCallback} db={props.db} />
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <div style={{ flex: '1 1 auto' }}>
                            <AsyncSelect
                                key={JSON.stringify(playlists)}
                                value={selectedPlaylist}
                                placeholder="Choose playlist..."
                                cacheOptions
                                defaultOptions
                                isClearable={true}
                                loadOptions={promiseOptions}
                                components={animatedComponents}
                                onChange={(newValue, actionMeta) => { handleChanged(newValue) }} />
                        </div>
                        <div onClick={handleAddPlaylistOpen} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 3, paddingRight: 3 }}><Icon><AddIcon /></Icon></div>
                        <div onClick={handleEditPlaylistOpen} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 3, paddingRight: 3 }}><Icon><EditIcon /></Icon></div>
                        <div onClick={handleDeletePlaylist} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 3, paddingRight: 3 }}><Icon><DeleteIcon /></Icon></div>
                        <div onClick={handlePlaylistsHide} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 3, paddingRight: 3 }}><Icon><CloseIcon /></Icon></div>
                    </div>
                </Fragment>
            }
        </div>
    );

}
