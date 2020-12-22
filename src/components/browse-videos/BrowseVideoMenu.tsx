import { SpeedDial, SpeedDialAction } from '@material-ui/lab';
import React, { Fragment } from 'react';
import { BrowseEntry } from "../../models/browse-entry";
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import RemoveIcon from '@material-ui/icons/Remove';
import MoreVertIcon from '@material-ui/icons/MoreVert';

interface HandleActionCallback {
    (action: any, browseEntry: BrowseEntry): void
}

interface BrowseVideosProps {
    browseEntry: BrowseEntry;
    selectedPlaylist: string | null;
    handleActionCallback: HandleActionCallback;
}

export function BrowseVideoMenu(props: BrowseVideosProps) {
    const [open, setOpen] = React.useState(false);

    const getActions = (browseEntry: BrowseEntry) => {
        let actions: any[] = [];
        if (browseEntry) {
            if (!browseEntry.fromShare) {
                if (browseEntry.metaData.isPublic) {
                    actions = [
                        { icon: <ScreenShareIcon />, name: 'Share' },
                        { icon: <StopScreenShareIcon />, name: 'Edit' },
                        { icon: <AddIcon />, name: 'Add' }
                    ];
                }
                else {
                    actions = [
                        { icon: <ScreenShareIcon />, name: 'Share' },
                        { icon: <StopScreenShareIcon />, name: 'Unshare' },
                        { icon: <EditIcon />, name: 'Edit' },
                        { icon: <DeleteIcon />, name: 'Delete' }];
                }
            }

            if (props.selectedPlaylist) {
                actions.push({ icon: <RemoveIcon />, name: 'Remove from playlist' });
            }
            else {
                actions.push({ icon: <AddIcon />, name: 'Add to playlist' });
            }
        }

        return actions;
    }
    const handleClose = () => {
        setOpen(false);
    };

    const handleOpen = (event: any) => {
        if (event.type !== "focus") {
            setOpen(true);
        }
    };

    return (
        <Fragment>
            <div style={{ width: 40 }}>
            </div>
            <div style={{ position: 'relative', top: -15 }}>
                <SpeedDial
                    ariaLabel="Menu Dial"
                    style={{ left: -47, position: 'absolute' }}
                    icon={<MoreVertIcon />}
                    onClose={handleClose}
                    onOpen={handleOpen}
                    open={open}
                    direction={"down"}>
                    {getActions(props.browseEntry).map((action) => (
                        <SpeedDialAction
                            key={action.name}
                            icon={action.icon}
                            tooltipTitle={action.name}
                            onClick={() => props.handleActionCallback(action, props.browseEntry)}
                        />
                    ))}
                </SpeedDial>
            </div>
        </Fragment>
    )
}