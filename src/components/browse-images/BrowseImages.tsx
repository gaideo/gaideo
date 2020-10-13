import React, { useEffect, Fragment, useCallback } from 'react';
import { useConnect } from '@blockstack/connect';
import { Box, Button, Typography, IconButton } from '@material-ui/core';
import { useHistory } from 'react-router-dom';
import { addToGroup, getCacheEntries, getCacheEntriesFromGroup, getCacheEntriesFromSearch, getSelectedGroup, getSelectedShares, removeFromGroup, shareFile } from '../../utilities/gaia-utils';
import { deleteImageEntry, ImagesType, loadBatchImages } from '../../utilities/media-utils';
import Gallery from 'react-photo-gallery';
import SelectedImage from './SelectedImage';
import { Photo } from '../../models/photo';
import { MediaMetaData } from '../../models/media-meta-data';
import { SlideShow } from './SlideShow';
import { trackPromise } from 'react-promise-tracker';
import { IDBPDatabase } from 'idb';
import { ImagesLoadedCallback, UpdateProgressCallback } from '../../models/callbacks';
import { ShareUserEntry } from '../../models/share-user-entry';
import { CacheResults } from '../../models/cache-entry';
import PublishIcon from '@material-ui/icons/Publish';

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
    searchText: string
}

const MAX_MORE = 12;
const batchSize = 4;

export function BrowseImages(props: BrowseImagesProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [isSelectable, setIsSelectable] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [cacheResults, setCacheResults] = React.useState<CacheResults | null>(null);
    const [selectedFriends, setSelectedFriends] = React.useState<Array<string> | null>(null);
    const [selectedPlaylist, setSelectedPlaylist] = React.useState<string | null>(null);
    const history = useHistory();
    const [noResults, setNoResults] = React.useState(false);
    const db = props.db;
    const worker = props.worker;
    const imagesLoadedCallback = props.imagesLoadedCallback;
    const photos = props.photos;

    useEffect(() => {


        const refresh = async () => {
            let arr: Photo[] = [];
            if (db && userSession?.isUserSignedIn()) {
                let sp = await getSelectedGroup(userSession);
                let moreCacheResults;
                if (props.searchText && props.searchText.trim().length > 0) {
                    moreCacheResults = await getCacheEntriesFromSearch(db, ImagesType, props.searchText, MAX_MORE, null);
                }
                else {
                    if (sp) {
                        moreCacheResults = await getCacheEntriesFromGroup(userSession, db, ImagesType, worker, sp, MAX_MORE, null);
                    }
                    else {
                        let sf = await getSelectedShares(userSession);
                        setSelectedFriends(sf);
                        moreCacheResults = await getCacheEntries(userSession, db, ImagesType, MAX_MORE, null, sf);
                    }
                    setSelectedPlaylist(sp);
                }
                setIsSelectable(false);
                if (moreCacheResults.cacheEntries?.length > 0) {
                    setNoResults(false);
                    for (let i = 0; i < moreCacheResults.cacheEntries?.length; i += batchSize) {
                        if (i === 0) {
                            await trackPromise(loadBatchImages(userSession, i, moreCacheResults.cacheEntries, arr, batchSize, imagesLoadedCallback));
                        }
                        else {
                            loadBatchImages(userSession, i, moreCacheResults.cacheEntries, arr, batchSize, imagesLoadedCallback);
                        }
                    }
                    if (moreCacheResults.nextKey && moreCacheResults.nextPrimaryKey) {
                        setCacheResults(moreCacheResults);
                    }
                    else {
                        setCacheResults(null);
                    }
                }
                else {
                    setNoResults(true);
                }

            }
        }
        if (photos.length === 0) {
            refresh();
        }
    }, [userSession, photos, db, imagesLoadedCallback, worker, props.searchText]);

    const loadMore = async () => {
        if (userSession && props.db && cacheResults && cacheResults.nextKey && cacheResults.nextPrimaryKey) {
            try {
                setLoadingMore(true)
                let arr: Photo[] = props.photos;
                let moreCacheResults;
                if (props.searchText && props.searchText.trim().length > 0) {
                    moreCacheResults = await getCacheEntriesFromSearch(props.db, ImagesType, props.searchText, MAX_MORE, cacheResults);
                }
                else if (selectedPlaylist) {
                    moreCacheResults = await getCacheEntriesFromGroup(userSession, props.db, ImagesType, props.worker, selectedPlaylist, MAX_MORE, cacheResults);
                }
                else {
                    moreCacheResults = await getCacheEntries(userSession, props.db, ImagesType, MAX_MORE, cacheResults, selectedFriends);
                }
                if (moreCacheResults.cacheEntries?.length > 0) {
                    for (let i = 0; i < moreCacheResults.cacheEntries?.length; i += batchSize) {
                        await loadBatchImages(userSession, i, moreCacheResults.cacheEntries, arr, batchSize, imagesLoadedCallback);
                    }
                }
                if (moreCacheResults.nextKey && moreCacheResults.nextPrimaryKey) {
                    setCacheResults(moreCacheResults);
                }
                else {
                    setCacheResults(null);
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
            if (props.photos[i].browseEntry.metaData.id === photo.browseEntry.metaData.id) {
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
            if (props.photos[i].browseEntry.metaData.id === photo.browseEntry.metaData.id) {
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
        const removeSelectedImages = async (arr: MediaMetaData[]) => {
            if (userSession) {
                for (let j = 0; j < arr.length; j++) {
                    await deleteImageEntry(arr[j], userSession, props.worker, props.updateProgressCallback);
                }
            }
            history.go(0);
        }
        const removeArray: MediaMetaData[] = [];
        for (let i = 0; i < props.photos.length; i++) {
            if (props.photos[i].selected) {
                removeArray.push(props.photos[i].browseEntry.metaData);
            }
        }
        if (removeArray.length > 0) {
            trackPromise(removeSelectedImages(removeArray));
        }
    }, [history, props.photos, userSession, props.worker, props.updateProgressCallback]);

    const shareSelectedCallback = useCallback((shareUsers: ShareUserEntry[], unshare: boolean) => {
        if (userSession?.isUserSignedIn()) {
            const shareArray: MediaMetaData[] = [];
            for (let i = 0; i < props.photos.length; i++) {
                if (props.photos[i].selected) {
                    shareArray.push(props.photos[i].browseEntry.metaData);
                }
            }
            if (shareArray.length > 0) {
                trackPromise(shareFile(shareArray, userSession, shareUsers, unshare));
            }
        }
    }, [props.photos, userSession]);

    const addGroupSelectedCallback = useCallback((groupids: string[]) => {
        if (userSession?.isUserSignedIn()) {
            const fileArray: MediaMetaData[] = [];
            for (let i = 0; i < props.photos.length; i++) {
                if (props.photos[i].selected) {
                    fileArray.push(props.photos[i].browseEntry.metaData);
                }
            }
            if (fileArray.length > 0) {
                trackPromise(addToGroup(fileArray, userSession, groupids));
            }
        }
    }, [props.photos, userSession]);

    const closeSlideShowCallback = useCallback(() => {
        props.setSlideShowIndexCallback(null);
    }, [props]);

    const removeSelectedFromGroupCallback = useCallback(() => {
        const removePhotoFromGroup = async () => {
            const fileArray: MediaMetaData[] = [];
            let newArray: Photo[] = [];
            for (let i = 0; i < props.photos.length; i++) {
                if (props.photos[i].selected) {
                    fileArray.push(props.photos[i].browseEntry.metaData);
                }
                else {
                    newArray.push(props.photos[i]);
                }
            }
            if (fileArray.length > 0
                && selectedPlaylist
                && userSession?.isUserSignedIn()) {

                await removeFromGroup(fileArray, userSession, selectedPlaylist);
                imagesLoadedCallback(newArray);
                setIsSelectable(false);
            }

        }
        trackPromise(removePhotoFromGroup());
    }, [props.photos, imagesLoadedCallback, selectedPlaylist, userSession]);

    const imageRenderer = useCallback(
        ({ index, left, top, key, photo }) => (
            <Box key={photo.browseEntry.metaData.id}>
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
                    addGroupSelectedCallback={addGroupSelectedCallback}
                    selectedPlaylist={selectedPlaylist}
                    removeSelectedFromGroupCallback={removeSelectedFromGroupCallback}
                />
            </Box>
        ),
        [deletePhotoCallback, selectImageCallback, toggleSelectionCallback,
            isSelectable, deleteSelectedCallback, props.photos.length,
            props.worker, props.updateProgressCallback, shareSelectedCallback,
            selectedPlaylist, addGroupSelectedCallback, removeSelectedFromGroupCallback]

    );

    const canLoadMore = () => {
        if (props.photos.length >= MAX_MORE && cacheResults) {
            return true;
        }
        return false;
    }
    return (
        <Fragment>
            {noResults &&
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', paddingLeft: !props.isMobile ? 20 : 0, height: '80vh', width: 'calc(100%-20)' }}>
                    <div style={{ width: '100%', textAlign: 'center' }}>
                        <Typography variant="h5">
                            <IconButton color="primary" onClick={() => { history.push('/publish') }}><PublishIcon />Upload</IconButton></Typography>
                        <Typography variant="h5">No Results Found.</Typography>
                    </div>
                </div>
            }
            {(props.photos && props.photos.length > 0 && props.slideShowIndex !== null) &&
                <SlideShow
                    images={props.photos}
                    current={props.slideShowIndex}
                    closeSlideShowCallback={closeSlideShowCallback}
                />
            }
            {(props.photos && props.photos.length > 0 && props.slideShowIndex === null) &&
                <div style={{ paddingLeft: !props.isMobile ? 22 : 0 }}>
                    <Gallery photos={props.photos} direction={"row"} renderImage={imageRenderer} />
                    {canLoadMore() &&
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Button disabled={loadingMore} onClick={loadMore}>Show More</Button>
                        </div>
                    }
                </div>
            }
        </Fragment>
    );
}
