import React from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import { useConnect } from '@blockstack/connect';
import { getPublicKey } from '../../utilities/gaia-utils';
import { UserData } from 'blockstack/lib/auth/authApp';

interface SetAddFriendDialogOpenCallback {
    (open: boolean, friend: string | null): void

}

interface AddFriendDialogProps {
    open: boolean
    setAddFriendDialogOpenCallback: SetAddFriendDialogOpenCallback
}

export default function AddFriendDialog(props: AddFriendDialogProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [userName, setUserName] = React.useState('');
    const [userNameError, setUserNameError] = React.useState(false);
    const [userNameErrorMessage, setUserNameErrorMessage] = React.useState('');

    const handleClose = () => {
        props.setAddFriendDialogOpenCallback(false, null);
    };

    const isSelf = (userName: string, userData: UserData) => {
        const un = userName.toLowerCase();
        const current = userData.username?.toLowerCase();
        if (current && (un === current || `${un}.id.blockstack` === current)) {
            return true;
        }
        return false;
    }

    const handleAdd = async () => {
        let publicKey: string | null = null;
        let un = userName;
        let error = "Invalid blockstack user name.";
        if (userSession?.isUserSignedIn()) {
            let userData = userSession.loadUserData();
            if (!isSelf(un, userData)) {
                try {
                    publicKey = await getPublicKey(userData, un);
                }
                catch {
                    un = `${un}.id.blockstack`;
                    try {
                        publicKey = await getPublicKey(userData, un);
                    }
                    catch { }
                }
            }
            else {
                error = "You cannot be friends with yourself!";
            }
            if (publicKey) {
                props.setAddFriendDialogOpenCallback(false, un);
                return;
            }
        }
        setUserNameError(true);
        setUserNameErrorMessage(error);
    }

    return (
        <div>
            <Dialog open={props.open} onClose={handleClose} aria-labelledby="form-dialog-title">
                <DialogTitle id="form-dialog-title">Add Friend</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Please enter your friend's blockstack user name.
          </DialogContentText>
                    <TextField
                        error={userNameError}
                        helperText={userNameErrorMessage}
                        autoFocus
                        margin="dense"
                        id="name"
                        label="User Name"
                        fullWidth
                        value={userName}
                        onChange={e => {
                            setUserName(e.target.value);
                            setUserNameError(false);
                            setUserNameErrorMessage('');
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="primary">
                        Cancel
          </Button>
                    <Button onClick={handleAdd} color="primary">
                        Add
          </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}