import React, { useEffect, useState } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import { useConnect } from '@blockstack/connect';

interface SetProfileOpenCallback {
    (open: boolean): void

}

interface ProfileDialogProps {
    open: boolean
    setProfileDialogOpenCallback: SetProfileOpenCallback
}

export default function ProfileDialog(props: ProfileDialogProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [ userName, setUserName ] = useState('');

    useEffect(() => {
        if (userSession?.isUserSignedIn()) {
            const ud = userSession.loadUserData();
            setUserName(ud.username);
        }
    }, [userSession]);

    const handleClose = () => {
        props.setProfileDialogOpenCallback(false);
    };


    const handleSave = async () => {
        props.setProfileDialogOpenCallback(false);
    }

    return (
        <div>
            <Dialog open={props.open} onClose={handleClose} aria-labelledby="form-dialog-title">
                <DialogTitle id="form-dialog-title">Profile</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Your blockstack user ID is: <strong>{userName}</strong>
          </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} color="primary">
                        Save
          </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}