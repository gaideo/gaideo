import React, { useEffect, useState } from 'react';
import Button from '@material-ui/core/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Dialog from '@material-ui/core/Dialog';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { Checkbox, Typography } from '@material-ui/core';
import { ShareUserEntry } from '../../models/share-user-entry';
import { MediaMetaData } from '../../models/media-meta-data';

export interface ShareUserDialogProps {
    open: boolean;
    unshare: boolean;
    initialUsers: string[];
    metaData: MediaMetaData | null;
    shareUsersResult: (item: MediaMetaData, unshare: boolean, shareEntries?: ShareUserEntry[]) => void;
}

export default function ShareUserDialog(props: ShareUserDialogProps) {

    const [shareEntries, setShareEntries] = useState<Array<ShareUserEntry>>([]);

    useEffect(() => {

        const users = props.initialUsers.map((x: string) => {
            return {
                userName: x,
                share: false
            }
        })
        setShareEntries(users);
    }, [props.initialUsers])

    const handleEntering = () => {
    };

    const handleCancel = () => {
        if (props.metaData) {
            props.shareUsersResult(props.metaData, props.unshare);
        }
    };

    const handleOk = () => {
        if (props.metaData) {
            props.shareUsersResult(props.metaData, props.unshare, shareEntries.slice());
        }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
        let newShareEntries = shareEntries.slice();
        newShareEntries[index].share = (event.target as HTMLInputElement).checked;
        setShareEntries(newShareEntries);
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
            <DialogTitle id="share-user-dialog-title">{props.unshare ? 'Unshare' : 'Share'} Media</DialogTitle>
            <DialogContent dividers>
                <div style={{display: 'flex', flexDirection: 'column', minWidth: 300}}>
                {shareEntries.map((option, index) => (
                    <FormControlLabel
                        key={option.userName}
                        control={
                            <Checkbox
                                checked={shareEntries[index].share}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => { handleChange(event, index); }}
                                name={`check${option.userName}`}
                                color="primary"
                            />
                        }
                        label={option.userName}
                    />
                ))}
                </div>
                {shareEntries.length === 0 &&
                <div>
                    <Typography variant="h6">{props.unshare ? 'This media is not shared with anyone.' : 'You need to add friends before you can share media.'}</Typography>
                </div>
                }
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
