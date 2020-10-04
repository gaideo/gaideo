import React, { useEffect, Fragment, useCallback } from 'react';
import { useConnect } from '@blockstack/connect';
import { Box, Button } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import { useHistory } from 'react-router-dom';
import { getCacheEntries, getSelectedShares, shareMedia } from '../../utilities/data-utils';
import { deleteImageEntry, loadBrowseEntryFromCache } from '../../utilities/media-utils';
import Gallery from 'react-photo-gallery';
import SelectedImage from './SelectedImage';
import { Photo } from '../../models/photo';
import { MediaEntry, MediaType } from '../../models/media-entry';
import { SlideShow } from './SlideShow';
import { trackPromise } from 'react-promise-tracker';
import { IDBPDatabase } from 'idb';
import { ImagesLoadedCallback, UpdateProgressCallback } from '../../models/callbacks';
import { ShareUserEntry } from '../../models/share-user-entry';

interface ToggleCloseCallback {
    (): void
}

interface SetSlideShowIndexCallback {
    (index: number | null): void
}

interface BrowseImagesProps {
    photos: Photo[];
    db: IDBPDatabase<unknown> | null;
    imagesLoadedCallback: ImagesLoadedCallback;
    toggleCloseCallback: ToggleCloseCallback;
    slideShowIndex: number | null;
    setSlideShowIndexCallback: SetSlideShowIndexCallback;
    worker: Worker | null;
    isMobile: boolean;
    updateProgressCallback: UpdateProgressCallback;
}

export function BrowseImages(props: BrowseImagesProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [isSelectable, setIsSelectable] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [lastCacheKeys, setLastCacheKeys] = React.useState<IDBValidKey[] | null>(null);
    const [selectedFriends, setSelectedFriends] = React.useState<Array<string> | null>(null);
    const history = useHistory();
    const MAX_MORE = 12;

    function gcd(a: number, b: number): number {
        if (b === 0)
            return a
        return gcd(b, a % b);
    }

    const loadPhoto = (be: BrowseEntry, img: HTMLImageElement, src: string) => {
        var r = gcd(img.width, img.height,);
        let aspectWidth = img.width / r;
        let aspectHeight = img.height / r;
        let photo: Photo = {
            browseEntry: be,
            width: aspectWidth,
            height: aspectHeight,
            title: be.mediaEntry.title,
            src: src,
            selected: false,
            aspectWidth: aspectWidth,
            aspectHeight: aspectHeight
        }
        return photo;
    }

    const loadPhotoCallback = useCallback(loadPhoto, []);
    const db = props.db;
    const imagesLoadedCallback = props.imagesLoadedCallback;
    const photos = props.photos;

    useEffect(() => {


        const refresh = async () => {
            let arr: Photo[] = [];
            if (db && userSession?.isUserSignedIn()) {
                let sf = await getSelectedShares(userSession);
                setSelectedFriends(sf);
                let cacheResults = await getCacheEntries(userSession, db, MediaType.Images, MAX_MORE, null, sf);
                if (cacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < cacheResults.cacheEntries?.length; i++) {

                        let decryptedData = await userSession.decryptContent(cacheResults.cacheEntries[i].data) as string;
                        if (decryptedData) {
                            let mediaEntry = JSON.parse(decryptedData);
                            let be = await loadBrowseEntryFromCache(userSession, mediaEntry, true) as BrowseEntry
                            if (be) {
                                let img = new Image();
                                let src = `data:image/png;base64, ${be.previewImage}`;
                                img.onload = ev => {
                                    let photo = loadPhotoCallback(be, img, src);
                                    arr.push(photo)
                                    imagesLoadedCallback(arr.slice())
                                };
                                img.src = src;
                            }
                        }
                    }
                    if (cacheResults.nextKey && cacheResults.nextPrimaryKey) {
                        setLastCacheKeys([cacheResults.nextKey, cacheResults.nextPrimaryKey]);
                    }
                }
            }
        }
        if (photos.length === 0) {
            refresh();
        }
    }, [userSession, photos, db, imagesLoadedCallback, loadPhotoCallback]);

    const loadMore = async () => {
        if (userSession && props.db && lastCacheKeys && lastCacheKeys?.length > 0) {

            try {
                setLoadingMore(true)
                let arr: Photo[] = props.photos;
                let cacheResults = await getCacheEntries(userSession, props.db, MediaType.Images, MAX_MORE, lastCacheKeys, selectedFriends);
                if (cacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < cacheResults.cacheEntries?.length; i++) {
                        let decryptedData = await userSession.decryptContent(cacheResults.cacheEntries[i].data) as string;
                        if (decryptedData) {
                            let mediaEntry = JSON.parse(decryptedData);
                            let be = await loadBrowseEntryFromCache(userSession, mediaEntry, true) as BrowseEntry
                            if (be) {
                                let img = new Image();
                                let src = `data:image/png;base64, ${be.previewImage}`;
                                img.onload = ev => {
                                    let photo = loadPhoto(be, img, src);
                                    arr.push(photo)
                                    props.imagesLoadedCallback(arr.slice())
                                };
                                img.src = src;
                            }
                        }
                    }
                    if (cacheResults.nextKey && cacheResults.nextPrimaryKey) {
                        setLastCacheKeys([cacheResults.nextKey, cacheResults.nextPrimaryKey]);
                    }
                    else {
                        setLastCacheKeys(null);
                    }
                }
            }
            finally {
                setLoadingMore(false);
            }
        }
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
                props.setSlideShowIndexCallback(index);
                props.toggleCloseCallback();
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
            if (userSession) {
                for (let j = 0; j < arr.length; j++) {
                    await deleteImageEntry(arr[j], userSession, props.worker, props.updateProgressCallback);
                }
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
    }, [history, props.photos, userSession, props.worker, props.updateProgressCallback]);

    const shareSelectedCallback = useCallback((shareUsers: ShareUserEntry[]) => {
        if (userSession?.isUserSignedIn()) {
            const shareArray: MediaEntry[] = [];
            for (let i = 0; i < props.photos.length; i++) {
                if (props.photos[i].selected) {
                    shareArray.push(props.photos[i].browseEntry.mediaEntry);
                }
            }
            if (shareArray.length > 0) {
                trackPromise(shareMedia(shareArray, userSession, shareUsers));
            }
        }
    }, [props.photos, userSession]);

    const closeSlideShowCallback = useCallback(() => {
        props.setSlideShowIndexCallback(null);
    }, [props]);

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
                    totalCount={props.photos.length}
                    deleteCallback={deletePhotoCallback}
                    selectImageCallback={selectImageCallback}
                    toggleSelectionCallback={toggleSelectionCallback}
                    deleteSelectedCallback={deleteSelectedCallback}
                    shareSelectedCallback={shareSelectedCallback}
                    worker={props.worker}
                    updateProgressCallback={props.updateProgressCallback}
                />
            </Box>
        ),
        [deletePhotoCallback, selectImageCallback, toggleSelectionCallback,
            isSelectable, deleteSelectedCallback, props.photos.length,
            props.worker, props.updateProgressCallback, shareSelectedCallback]

    );

    return (
        <Fragment>
            { props.slideShowIndex != null ? (
                <SlideShow
                    images={props.photos}
                    current={props.slideShowIndex}
                    closeSlideShowCallback={closeSlideShowCallback}
                />
            ) : (
                    <div style={{ paddingLeft: !props.isMobile ? 22 : 0 }}>
                        <Gallery photos={props.photos} direction={"row"} renderImage={imageRenderer} />
                        {props.photos.length >= MAX_MORE &&
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <Button disabled={loadingMore} onClick={loadMore}>Show More</Button>
                            </div>
                        }
                    </div>
                )}
        </Fragment>
    );
}
