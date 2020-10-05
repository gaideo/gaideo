import React, { useEffect, useState } from 'react';
import Button from '@material-ui/core/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Dialog from '@material-ui/core/Dialog';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { Checkbox } from '@material-ui/core';
import { MediaMetaData } from '../../models/media-meta-data';
import { useConnect } from '@blockstack/connect';
import { getGroups } from '../../utilities/gaia-utils';
import { AddPlaylistEntry } from '../../models/add-playlist-entry';

export interface AddToPlaylistDialogProps {
    open: boolean;
    metaData: MediaMetaData | null;
    result: (item: MediaMetaData, playlists?: string[]) => void;
}

export default function AddToPlaylistDialog(props: AddToPlaylistDialogProps) {

    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [playlists, setPlaylists] = useState<Array<AddPlaylistEntry>>([]);
    const open = props.open;

    useEffect(() => {
        const refresh = async () => {
            if (userSession?.isUserSignedIn() && open) {
                let list: AddPlaylistEntry[] = [];
                let groups = await getGroups(userSession);
                if (groups) {
                    for (let key in groups) {
                        let x = groups[key];
                        list.push({
                            id: x.id,
                            name: x.name,
                            add: false
                        });
                    }
                }
                list.sort((x,y) => {
                    if (!x && y) {
                        return -1;
                    }
                    else if (x && !y) {
                        return 1;
                    }
                    else if (x.name < y.name) {
                        return -1;
                    }
                    else if (x.name > y.name) {
                        return 1;
                    }
                    else {
                        return 0;
                    }
                })
                setPlaylists(list);
            }
        }
        refresh();
    }, [userSession, open])

    const handleEntering = () => {
    };

    const handleCancel = () => {
        if (props.metaData) {
            props.result(props.metaData);
        }
    };

    const handleOk = () => {
        if (props.metaData) {
            props.result(props.metaData, playlists.filter(x => x.add).map(x => x.id));
        }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
        let newPlaylists = playlists.slice();
        newPlaylists[index].add = (event.target as HTMLInputElement).checked;
        setPlaylists(newPlaylists);
    };

    return (
        <Dialog
            disableBackdropClick
            disableEscapeKeyDown
            maxWidth="xs"
            onEntering={handleEntering}
            aria-labelledby="share-user-dialog-title"
            open={props.open}
        >
            <DialogTitle id="share-user-dialog-title">Add to playlist</DialogTitle>
            <DialogContent dividers>
                <div style={{display: 'flex', flexDirection: 'column', minWidth: 300}}>
                {playlists.map((option, index) => (
                    <FormControlLabel
                        key={option.name}
                        control={
                            <Checkbox
                                checked={playlists[index].add}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => { handleChange(event, index); }}
                                name={`check${option.name}`}
                                color="primary"
                            />
                        }
                        label={option.name}
                    />
                ))}
                </div>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={handleCancel} color="primary">
                    Cancel
                </Button>
                <Button onClick={handleOk} color="primary">
                    Ok
                </Button>
            </DialogActions>
        </Dialog>
    );
}
