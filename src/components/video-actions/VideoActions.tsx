import React, { Fragment } from 'react';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useConnect } from '@blockstack/connect';
import { deleteVideoEntry } from '../../utilities/data-utils';
import { trackPromise } from 'react-promise-tracker';
import { VideoEntry } from '../../models/video-entry';
import { useHistory } from 'react-router-dom';

const options = [
    'Share',
    'Edit',
    'Delete'
];

const ITEM_HEIGHT = 48;

export default function VideoActions(props: any) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const history = useHistory();

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const handleMenu = (option: string) => {
        if (option === 'Delete') {
            let videoEntry: VideoEntry = props.videoEntry as VideoEntry;
            if (videoEntry) {
                trackPromise(deleteVideoEntry(videoEntry, userSession).then(x => {history.push("/")}))
            }
        }
        handleClose();
    };

    return (
        <Fragment>
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
                    <MenuItem key={option} selected={option === 'Edit'} onClick={() => handleMenu(option)}>
                        {option}
                    </MenuItem>
                ))}
            </Menu>
        </Fragment>
    );
}