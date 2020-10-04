import React, { useEffect } from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import { makeUUID4 } from 'blockstack';
import { Group } from '../../models/group';
import { useConnect } from '@blockstack/connect';
import { getGroup } from '../../utilities/gaia-utils';

interface SetAddPlaylistDialogOpenCallback {
    (open: boolean, playlist: Group | null, editID: string | undefined): void

}

interface AddPlaylistDialogProps {
    open: boolean;
    setAddPlaylistDialogOpenCallback: SetAddPlaylistDialogOpenCallback;
    id?: string;
}

export default function AddPlaylistDialog(props: AddPlaylistDialogProps) {
    const [playlistID, setPlaylistID] = React.useState('');
    const [playlistName, setPlaylistName] = React.useState('');
    const [playlistNameError, setPlaylistNameError] = React.useState(false);
    const [playlistNameErrorMessage, setPlaylistNameErrorMessage] = React.useState('');
    const { authOptions } = useConnect();
    const { userSession } = authOptions;

    const operation = props.id ? "Edit" : "Add";

    useEffect(() => {
        const refresh = async () => {
            if (userSession?.isUserSignedIn() && props.id) {
                let group = await getGroup(userSession, props.id);
                if (group) {
                    setPlaylistID(group.id);
                    setPlaylistName(group.name);
                }
            }
        }
        refresh();
    }, [userSession, props.id]);

    const handleClose = () => {
        props.setAddPlaylistDialogOpenCallback(false, null, undefined);
    };

    const handleAdd = async () => {
        let id = playlistID;
        if (!id) {
            id = makeUUID4();
        }

        if (playlistName && playlistName.trim().length > 0) {            
            props.setAddPlaylistDialogOpenCallback(false, {
                id: id,
                name: playlistName
            }, props.id)
        }
        else {
            setPlaylistNameError(true);
            setPlaylistNameErrorMessage("Invalid playlist name.");
        }
    }

    return (
        <div>
            <Dialog open={props.open} onClose={handleClose} aria-labelledby="form-dialog-title">
                <DialogTitle id="form-dialog-title">{`${operation} Playlist`}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please enter the name of your playlist.
          </DialogContentText>
                    <TextField
                        error={playlistNameError}
                        helperText={playlistNameErrorMessage}
                        autoFocus
                        margin="dense"
                        id="name"
                        label="User Name"
                        fullWidth
                        value={playlistName}
                        onChange={e => {
                            setPlaylistName(e.target.value);
                            setPlaylistNameError(false);
                            setPlaylistNameErrorMessage('');
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleAdd} color="primary">
                        { operation }
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}