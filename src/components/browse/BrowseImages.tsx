import React, { useEffect, Fragment, useCallback } from 'react';
import { useConnect } from '@blockstack/connect';
import { Box } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import "./BrowseVideos.css";
import { useHistory } from 'react-router-dom';
import { loadBrowseEntry } from '../../utilities/data-utils';
import Gallery from 'react-photo-gallery';
import SelectedImage from './SelectedImage';
import { Photo } from '../../models/photo';
import { MediaType } from '../../models/media-entry';

export function BrowseImages() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [photos, setPhotos] = React.useState(new Array<Photo>());
    const history = useHistory();

    useEffect(() => {

        const refresh = async () => {
            const indexes: string[] = [];
            let arr: Photo[] = [];
            userSession?.listFiles((name: string) => {
                if (name.startsWith("images/")
                    && name.endsWith(".index")) {
                    indexes.push(name);
                    loadBrowseEntry(userSession, name, true, MediaType.Images).then((x: any) => {
                        let be = x as BrowseEntry;
                        if (be) {
                            let photo: Photo = {
                                browseEntry: be,
                                width: 4,
                                height: 3,
                                title: be.mediaEntry.title,
                                src: `data:image/png;base64, ${be.previewImage}`
                        }
                            arr.push(photo)
                            setPhotos(arr.slice());
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


    const deletePhotoCallback = useCallback((photo: Photo) => {
        let index = -1;
        for (let i=0; i<photos.length; i++) {
            if (photos[i].browseEntry.mediaEntry.id === photo.browseEntry.mediaEntry.id) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            let newPhotos = photos.slice();
            newPhotos.splice(index, 1);
            setPhotos(newPhotos);
        }
    }, [photos]);

    const imageRenderer = useCallback(
        ({ index, left, top, key, photo }) => (
            <Box key={photo.browseEntry.mediaEntry.id}>
                <SelectedImage
                    direction={"row"}
                    selected={false}
                    key={key}
                    margin={"2px"}
                    index={index}
                    photo={photo}
                    left={left}
                    top={top}
                    selectable={false}
                    deleteCallback = {deletePhotoCallback}
                />
            </Box>
        ),
        [deletePhotoCallback]
        
    );

    return (
        <Fragment>
        <Gallery photos={photos} renderImage={imageRenderer} />
        </Fragment>
        );
    /*    return (
            <Fragment>
                <ConfirmDialog open={confirmOpen} item={menuMediaEntry} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete ${menuMediaEntry?.title}?`} />
                <Toolbar style={{ flexWrap: 'wrap' }}>
                    {browseEntries.map(x => (
                        <Box key={x.mediaEntry.id}>
                            <div style={{display: 'flex', cursor: 'pointer', maxHeight: 200, maxWidth: 300, alignContent: "center" }} onClick={() => { navImage(x); }}>
                                <img style={{ aspectRatio: '3/2', flex: 1  }} width="100%" id={x.mediaEntry.id} alt={x.mediaEntry.title} src={`data:image/png;base64, ${x.previewImage}`} />
                            </div>
                            <Toolbar style={{ justifyContent: 'space-between' }}>
                                <div onClick={() => { navImage(x) }}>
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
                        </Box>
                    ))}
                </Toolbar>
            </Fragment>
        );
        */
}
