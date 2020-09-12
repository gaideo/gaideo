import React, { useEffect, Fragment, useCallback } from 'react';
import { useConnect } from '@blockstack/connect';
import { Box, Button } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import { useHistory } from 'react-router-dom';
import { deleteImageEntry, loadBrowseEntry } from '../../utilities/data-utils';
import Gallery from 'react-photo-gallery';
import SelectedImage from './SelectedImage';
import { Photo } from '../../models/photo';
import { MediaEntry, MediaType } from '../../models/media-entry';
import { SlideShow } from './SlideShow';
import { trackPromise } from 'react-promise-tracker';

interface ImagesLoadedCallback {
    (photos: Photo[]): void
}

interface BrowseImagesProps {
    photos: Photo[];
    imagesLoadedCallback: ImagesLoadedCallback;
}

export function BrowseImages(props: BrowseImagesProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [slideShowIndex, setSlideShowIndex] = React.useState<number | null>(null);
    const [isSelectable, setIsSelectable] = React.useState(false);
    const history = useHistory();
    const MAX_MORE = 6;

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
                            props.imagesLoadedCallback(arr.slice())
                        }
                    })
                    if (indexes.length >= MAX_MORE) {
                        return false;
                    }
                }
                return true;
            })
        }
        if (props.photos.length === 0) {
            refresh();
        }
    }, [userSession, history, props]);

    const loadMore = () => {
        const indexes: string[] = [];
        let arr: Photo[] = props.photos;
        userSession?.listFiles((name: string) => {
            if (name.startsWith("images/")
                && name.endsWith(".index")) {
                let found = false;
                for (let i = 0; i < props.photos.length; i++) {
                    let indexFile = `images/${props.photos[i].browseEntry.mediaEntry.id}.index`;
                    if (indexFile === name) {
                        found = true;
                    }
                }
                if (!found) {
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
                            props.imagesLoadedCallback(arr.slice());
                        }
                    })
                }
                if (indexes.length >= MAX_MORE) {
                    return false;
                }
            }
            return true;
        })
    }

    const selectImageCallback = useCallback((photo: Photo) => {
        let index = -1;
        for (let i = 0; i < props.photos.length; i++) {
            if (props.photos[i].browseEntry.mediaEntry.id === photo.browseEntry.mediaEntry.id) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            if (isSelectable) {
                props.photos[index].selected = !props.photos[index].selected;
                props.imagesLoadedCallback(props.photos.slice());
            }
            else {
                setSlideShowIndex(index);
            }
        }

    }, [props, isSelectable]);

    const deletePhotoCallback = useCallback((photo: Photo) => {
        let index = -1;
        for (let i = 0; i < props.photos.length; i++) {
            if (props.photos[i].browseEntry.mediaEntry.id === photo.browseEntry.mediaEntry.id) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            let newPhotos = props.photos.slice();
            newPhotos.splice(index, 1);
            props.imagesLoadedCallback(newPhotos);
        }
    }, [props]);

    const closeSlideshowCallback = useCallback(() => {
        setSlideShowIndex(null);
    }, []);

    const toggleSelectionCallback = useCallback(() => {
        const s = !isSelectable;
        setIsSelectable(s);
        if (!s) {
            let newPhotos = props.photos.slice();
            for (let i = 0; i < newPhotos.length; i++) {
                newPhotos[i].selected = false;
            }
            props.imagesLoadedCallback(newPhotos);
        }
    }, [isSelectable, props]);

    const deleteSelectedCallback = useCallback(() => {
        const removeSelectedImages = async (arr: MediaEntry[]) => {
            for (let j = 0; j < arr.length; j++) {
                await deleteImageEntry(arr[j], userSession);
            }
            history.go(0);
        }
        const removeArray: MediaEntry[] = [];
        for (let i = 0; i < props.photos.length; i++) {
            if (props.photos[i].selected) {
                removeArray.push(props.photos[i].browseEntry.mediaEntry);
            }
        }
        if (removeArray.length > 0) {
            trackPromise(removeSelectedImages(removeArray));
        }
    }, [history, props.photos, userSession]);

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
                    images={props.photos}
                    current={slideShowIndex}
                    closeSlideshowCallback={closeSlideshowCallback} />
            ) : (
                    <div>
                        <Gallery photos={props.photos} renderImage={imageRenderer} />
                        {props.photos.length >= MAX_MORE &&
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <Button onClick={loadMore}>Show More</Button>
                            </div>
                        }
                    </div>
                )}
        </Fragment>
    );
}
