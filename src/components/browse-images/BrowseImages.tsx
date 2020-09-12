import React, { useEffect, Fragment, useCallback } from 'react';
import { useConnect } from '@blockstack/connect';
import { Box } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import { useHistory } from 'react-router-dom';
import { deleteImageEntry, loadBrowseEntry } from '../../utilities/data-utils';
import Gallery from 'react-photo-gallery';
import SelectedImage from './SelectedImage';
import { Photo } from '../../models/photo';
import { MediaEntry, MediaType } from '../../models/media-entry';
import { SlideShow } from './SlideShow';
import { trackPromise } from 'react-promise-tracker';

export function BrowseImages() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [photos, setPhotos] = React.useState(new Array<Photo>());
    const [slideShowIndex, setSlideShowIndex] = React.useState<number | null>(null);
    const [isSelectable, setIsSelectable] = React.useState(false);
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
                                src: `data:image/png;base64, ${be.previewImage}`,
                                selected: false
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


    const selectImageCallback = useCallback((photo: Photo) => {
        let index = -1;
        for (let i = 0; i < photos.length; i++) {
            if (photos[i].browseEntry.mediaEntry.id === photo.browseEntry.mediaEntry.id) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            if (isSelectable) {
                photos[index].selected = !photos[index].selected;
                setPhotos(photos.slice());
            }
            else {
                setSlideShowIndex(index);
            }
        }

    }, [photos, isSelectable]);

    const deletePhotoCallback = useCallback((photo: Photo) => {
        let index = -1;
        for (let i = 0; i < photos.length; i++) {
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

    const closeSlideshowCallback = useCallback(() => {
        setSlideShowIndex(null);
    }, []);

    const toggleSelectionCallback = useCallback(() => {
        const s = !isSelectable;
        setIsSelectable(s);
        if (!s) {
            let newPhotos = photos.slice();
            for (let i=0; i<newPhotos.length; i++) {
                newPhotos[i].selected = false;
            }
            setPhotos(newPhotos);
        }
    }, [isSelectable, photos]);

    const deleteSelectedCallback = useCallback(() => {
        const removeSelectedImages = async (arr: MediaEntry[]) =>
        {
            for (let j=0; j<arr.length; j++) {
                await deleteImageEntry(arr[j], userSession);
            }
            history.go(0);
        }
        const removeArray: MediaEntry[] = [];
        for (let i=0; i<photos.length; i++) {
            if (photos[i].selected) {
                removeArray.push(photos[i].browseEntry.mediaEntry);
            }
        }
        if (removeArray.length > 0) {
            trackPromise(removeSelectedImages(removeArray));
        }
    }, [history, photos, userSession]);

    const imageRenderer = useCallback(
        ({ index, left, top, key, photo }) => (
            <Box key={photo.browseEntry.mediaEntry.id}>
                <SelectedImage
                    direction={"row"}
                    selected={photo.selected}
                    key={key}
                    margin={"2px"}
                    index={index}
                    photo={photo}
                    left={left}
                    top={top}
                    selectable={isSelectable}
                    deleteCallback={deletePhotoCallback}
                    selectImageCallback={selectImageCallback}
                    toggleSelectionCallback={toggleSelectionCallback}
                    deleteSelectedCallback={deleteSelectedCallback}
                />
            </Box>
        ),
        [deletePhotoCallback, selectImageCallback, toggleSelectionCallback, isSelectable, deleteSelectedCallback]

    );

    return (
        <Fragment>
            { slideShowIndex != null ? (
                <SlideShow 
                    images={photos} 
                    current={slideShowIndex} 
                    closeSlideshowCallback={closeSlideshowCallback}/>
            ) : (
                <Gallery photos={photos} renderImage={imageRenderer} />
            )}
        </Fragment>
    );
}
