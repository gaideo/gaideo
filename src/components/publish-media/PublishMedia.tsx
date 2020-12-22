import React, { Fragment, useState, useEffect } from 'react';
import "./PublishMedia.css";
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import Button from '@material-ui/core/Button';
import { TextField, FormControl, Box, FormHelperText, FormControlLabel, Checkbox, Typography } from '@material-ui/core';
import Dropzone from '../dropzone/Dropzone';
import { MediaMetaData } from '../../models/media-meta-data';
import { useConnect } from '@blockstack/connect';
import { trackPromise } from 'react-promise-tracker';
import { useHistory, useParams } from 'react-router-dom';
import { createHashAddress, createPrivateKey, updateMasterIndex, getPrivateKey } from '../../utilities/gaia-utils';
import { deleteVideoEntry, ImagesType, loadBrowseEntry, UnencryptedVideosType, VideosType, MusicType } from '../../utilities/media-utils';
import { computeAge, getNow } from '../../utilities/time-utils';
import { getPublicKeyFromPrivate, makeUUID4, UserSession } from 'blockstack';
import { BrowseEntry } from '../../models/browse-entry';
import { Photo } from '../../models/photo';
import { ImagesLoadedCallback, UpdateProgressCallback, VideosLoadedCallback } from '../../models/callbacks';
import { readBinaryFile } from '../../utilities/file-utils';
import { FileEntry } from '../../models/file-entry';
import { computeNameFromImageFile, convertVideoToHls } from '../../utilities/ffmpeg-utils';
import { FileOperation } from '../../models/file-operation';

interface ParamTypes { id: string; type: string }

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            height: '100%'
        },
        button: {
            marginRight: theme.spacing(1),
        },
        instructions: {
            marginTop: theme.spacing(1),
            marginBottom: theme.spacing(1),
        },
    }),
);

interface PublishVideoProps {
    worker: Worker | null;
    videos: BrowseEntry[] | null;
    photos: Photo[] | null;
    songs: BrowseEntry[] | null;
    videosLoadedCallback: VideosLoadedCallback;
    imagesLoadedCallback: ImagesLoadedCallback;
    songsLoadedCallback: VideosLoadedCallback;
    isMobile: boolean;
    updateProgressCallback: UpdateProgressCallback;
}

export default function PublishVideo(props: PublishVideoProps) {
    const keywordsMessage: string = 'Letters, numbers, special characters # or -';
    type ValidateUploadResultDelegate = (filesToUpload: any[]) => MediaMetaData | string;

    const classes = useStyles();
    const [activeStep, setActiveStep] = React.useState(0);
    const [files, setFiles] = React.useState(Array<any>());
    const [uploading, setUploading] = React.useState(false);
    const [successfullUploaded, setSuccessfullUploaded] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [titleError, setTitleError] = React.useState(false);
    const [titleErrorMessage, setTitleErrorMessage] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [keywords, setKeywords] = React.useState('');
    const [keywordsError, setKeywordsError] = React.useState(false);
    const [keywordsErrorMessage, setKeywordsErrorMessage] = React.useState(keywordsMessage);
    const [uploadFilesError, setUploadFilesError] = React.useState(false);
    const [uploadFilesErrorMessage, setUploadFilesErrorMessage] = React.useState('');

    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const userData = userSession?.loadUserData();
    const history = useHistory();
    const { id, type } = useParams<ParamTypes>();
    const [steps, setSteps] = useState(Array<string>());
    const [isPublic, setIsPublic] = React.useState(false);

    const onFilesAdded = (files: any) => {
        setFiles(files);
    }

    const handleIsPublicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsPublic((event.target as HTMLInputElement).checked)
    };

    const getStepContent = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <Fragment>
                        <TextField
                            error={titleError}
                            label="Title"
                            value={title}
                            helperText={titleErrorMessage}
                            className="Input"
                            inputProps={{ maxLength: 75 }}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                setTitleError(false);
                                setTitleErrorMessage("");
                            }}
                        />
                        <TextField
                            label="Description"
                            value={description}
                            multiline
                            rows={4}
                            onChange={(e) => { setDescription(e.target.value) }}
                            className="Input"
                            inputProps={{ maxLength: 150 }}
                        />
                        <TextField
                            error={keywordsError}
                            label="Keywords"
                            value={keywords}
                            helperText={keywordsErrorMessage}
                            className="Input"
                            inputProps={{ maxLength: 150 }}
                            multiline
                            rows={4}
                            onChange={(e) => {
                                setKeywords(e.target.value);
                                setKeywordsError(false);
                                setKeywordsErrorMessage(keywordsMessage);
                            }}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isPublic}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => { handleIsPublicChange(event); }}
                                    name={`checkIsPublic`}
                                    color="primary"
                                />
                            }
                            label={"Is Public"}
                        />
                        {isPublic &&
                            <Typography variant="body1" color="error">Warning: Public media is not encrypted and will be viewable by anyone that adds you as a friend.</Typography>
                        }
                    </Fragment>)
            case 1:
                return renderUpload();
            default:
                return 'Unknown step';
        }
    }


    const renderUpload = () => {
        return (
            <div className="Upload">
                <span className="Title">Upload Files</span>
                <div className="Content">
                    <div>
                        <Dropzone
                            onFilesAdded={onFilesAdded}
                            disabled={uploading || successfullUploaded}
                        />
                    </div>
                    <div className="Files" style={{ maxHeight: 500 }}>
                        {files.map(file => {
                            return (
                                <div key={file.name} className="Row">
                                    <span className="Filename">{file.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {uploadFilesError && <FormHelperText style={{ paddingTop: 10 }} error={true} id="upload-error-message">{uploadFilesErrorMessage}</FormHelperText>}
            </div>
        );
    }

    const isValidKeywords = () => {
        if (keywords
            && keywords.length > 0
            && !/^[a-z0-9\-#\s]+$/i.test(keywords)) {
            setKeywordsError(true);
            setKeywordsErrorMessage(keywordsErrorMessage)
            return false;
        }
        return true;
    }

    const isPreviewImage = (name: string, lowerCase: boolean) => {
        let lname: string = name;
        if (lowerCase) {
            lname = name.toLowerCase();
        }
        return lname.endsWith('_preview.jpg');
    }

    const isImageName = (name: string, lowerCase: boolean) => {
        let lname: string = name;
        if (lowerCase) {
            lname = name.toLowerCase();
        }
        return !lname.endsWith('_preview.jpg')
            && (lname.endsWith('.jpg')
                || lname.endsWith('.jpeg')
                || lname.endsWith('.png'));
    }

    const isUnencryptedVideo = (name: string, lowerCase: boolean) => {
        let lname: string = name;
        if (lowerCase) {
            lname = name.toLocaleLowerCase();
        }
        return lname.endsWith('.mp4')
            || lname.endsWith('.mov')
            || lname.endsWith('.mkv')
            || lname.endsWith('.mp3')
            || lname.endsWith('.avi');
    }

    const validateUpload: ValidateUploadResultDelegate = (filesToUpload) => {
        if (!filesToUpload || filesToUpload.length === 0) {
            return "No media files selected to upload.";
        }

        let hasError: boolean = false;
        let errorMessage = '';

        try {
            let foundKey: boolean = false;
            let previewImageName: string | null = null;
            let imageCount: number = 0;
            let unencryptedVideoCount: number = 0;
            let id: string = '';
            let manifest: string[] = [];
            id = makeUUID4();

            for (let i = 0; i < filesToUpload.length; i++) {
                let f: any = filesToUpload[i];
                if (!f.name) {
                    hasError = true;
                    break;
                }
                let name: string = f.name;
                let lname: string = name.toLowerCase();
                let unencryptedVideo = isUnencryptedVideo(lname, false);
                let previewImage = isPreviewImage(lname, false)
                let imageName = isImageName(lname, false);
                if (!lname.endsWith('.m3u8')
                    && !lname.endsWith('keys')
                    && lname !== 'key.bin'
                    && !lname.endsWith('.ts')
                    && !unencryptedVideo
                    && !previewImage
                    && !imageName) {
                    errorMessage = "Unrecognized file type.  Supported file types are: .mp4, .mp3, .mov, .avi, .mkv, .m3u8, .ts, key.bin, .jpg, .jpeg, and .png";
                    hasError = true;
                    break;
                }
                if (!imageName && lname.indexOf(' ') >= 0) {
                    hasError = true;
                    errorMessage = "Video files cannot have spaces in the name.";
                    break;
                }
                if (imageName) {
                    imageCount++;
                }
                else if (unencryptedVideo) {
                    unencryptedVideoCount++;
                }
                else if (previewImage) {
                    previewImageName = name;
                }
                if (lname !== 'keys' && !unencryptedVideo) {
                    manifest.push(`${name}`);
                }
                if (lname === 'key.bin') {
                    foundKey = true;
                }
            }
            if (!hasError) {
                if (unencryptedVideoCount > 0 && (unencryptedVideoCount > 1 || unencryptedVideoCount < filesToUpload.length)) {
                    errorMessage = "You can only upload one unencrypted video at a time.";
                    hasError = true;
                }
                else if (imageCount > 0 && imageCount < filesToUpload.length) {
                    errorMessage = "You cannot upload photos with any other media type."
                    hasError = true;
                }
                else if (imageCount === 0 && unencryptedVideoCount === 0 && ((!foundKey && !isPublic) || !previewImageName)) {
                    if (!foundKey) {
                        errorMessage = "Missing key file for HLS stream.";
                    }
                    else if (!previewImageName) {
                        errorMessage = "Missing preview image for HLS stream. Preview files must end with '_preview.jpg'";
                    }
                    hasError = true;
                }
            }

            if (!hasError
                && userData
                && (userData.username?.length > 0 || userData?.identityAddress?.length > 0)) {
                let kwds: string[] | null = null;
                if (keywords?.length > 0) {
                    kwds = keywords.split(/\s+/g).filter(x => x.trim().length !== 0);
                }
                let nowUTC = getNow();

                if (imageCount === filesToUpload.length) {
                    const imagesEntry: MediaMetaData = {
                        id: id,
                        title: title,
                        description: description,
                        keywords: kwds,
                        userName: userData?.username,
                        identityAddress: userData?.identityAddress,
                        manifest: manifest,
                        createdDateUTC: nowUTC,
                        lastUpdatedUTC: nowUTC,
                        type: ImagesType,
                        isPublic: isPublic
                    }
                    return imagesEntry;
                }
                else if (unencryptedVideoCount === 1) {
                    const metaData: MediaMetaData = {
                        id: id,
                        title: title,
                        description: description,
                        keywords: kwds,
                        userName: userData?.username,
                        identityAddress: userData?.identityAddress,
                        manifest: manifest,
                        createdDateUTC: nowUTC,
                        lastUpdatedUTC: nowUTC,
                        type: UnencryptedVideosType,
                        previewImageName: computeNameFromImageFile(filesToUpload[0].name),
                        isPublic: isPublic
                    }
                    return metaData;
                }
                else {
                    if (previewImageName && previewImageName.trim().length > 0) {
                        id = createHashAddress([id, previewImageName.replace('_preview.jpg', '')]);
                    }
                    const metaData: MediaMetaData = {
                        id: id,
                        title: title,
                        description: description,
                        keywords: kwds,
                        userName: userData?.username,
                        identityAddress: userData?.identityAddress,
                        manifest: manifest,
                        createdDateUTC: nowUTC,
                        lastUpdatedUTC: nowUTC,
                        type: VideosType,
                        previewImageName: previewImageName ? `videos/${id}/${previewImageName}` : '',
                        isPublic: isPublic
                    }
                    return metaData;
                }
            }
        }
        catch (error) {
            errorMessage = "Unable to upload files.  Unknown error."
            console.log(error);
        }
        return errorMessage;
    }

    const getVideoFileContentType = (name: string) => {
        if (name.endsWith(".m3u8")) {
            return "vnd.apple.mpegURL"
        }
        else if (name.endsWith(".ts")) {
            return "video/MP2T"
        }
        else {
            return "application/octet-stream"
        }
    }

    const needEncryptVideoFile = (name: string) => {
        if (name === "key.bin" || name.endsWith("_preview.jpg")) {
            return true;
        }
        return false;
    }

    const uploadVideo = async (file: any, metaData: MediaMetaData, userSession: UserSession, privateKey: string) => {
        try {
            let name: string = `${metaData.type}/${metaData.id}/${file.name}`;
            if (needEncryptVideoFile(file.name)) {
                let data;
                if (file.data) {
                    data = file.data;
                }
                else {
                    data = await readBinaryFile(file);
                }
                let buffer = Buffer.from(new Uint8Array(data));
                if (privateKey) {
                    let publicKey = getPublicKeyFromPrivate(privateKey);
                    let encryptedData = await userSession.encryptContent(buffer, {
                        publicKey: publicKey
                    });
                    await userSession.putFile(name, encryptedData, {
                        encrypt: false,
                        wasString: true,
                        contentType: 'application/json'
                    })
                }
                else {
                    await userSession.putFile(name, buffer, {
                        encrypt: false,
                        wasString: true,
                        contentType: getVideoFileContentType(file.name)
                    })
                }
            }
            else {
                let data;
                if (file.data) {
                    data = file.data;
                }
                else {
                    data = file;
                }
                await userSession.putFile(name, data, {
                    encrypt: false,
                    wasString: false,
                    contentType: getVideoFileContentType(file.name)
                })
            }
            return true;

        }
        catch (error) {
            console.log(`Unable to upload video file: ${file.name}`);
            console.log(error);
        }
        return false;
    }

    const uploadImage = async (file: any, metaData: MediaMetaData, userSession: any) => {
        let ret: FileEntry | null = null;
        try {
            let copy = { ...metaData };
            copy.id = createHashAddress([metaData.id, file.name]);
            copy.manifest = [file.name];
            if (metaData.manifest.length > 1) {
                copy.title = `${title} (${file.name})`;
            }
            let privateKey = '';
            if (!isPublic) {
                privateKey = await createPrivateKey(userSession, copy.id, ImagesType);
            }
            if (privateKey || isPublic) {
                let indexFile = `images/${copy.id}.index`;

                let data = JSON.stringify(copy);
                let publicKey = '';
                if (privateKey) {
                    publicKey = getPublicKeyFromPrivate(privateKey);
                    data = await userSession.encryptContent(data, {
                        publicKey: publicKey
                    });
                }

                await userSession.putFile(indexFile, data, {
                    encrypt: false,
                    wasString: true,
                    contentType: 'application/json'
                })

                try {
                    let name: string = `images/${copy.id}/${file.name}`;

                    let data = await readBinaryFile(file);
                    let buffer = Buffer.from(new Uint8Array(data));
                    if (privateKey) {
                        let encryptedData = await userSession.encryptContent(buffer, {
                            publicKey: publicKey
                        });
                        await userSession.putFile(name, encryptedData, {
                            encrypt: false,
                            wasString: true,
                            contentType: 'application/json'
                        })
                    }
                    else {
                        await userSession.putFile(name, buffer, {
                            encrypt: false,
                            wasString: true
                        });
                    }
                    ret = {
                        id: copy.id,
                        type: copy.type,
                        isPublic: copy.isPublic,
                        lastUpdatedUTC: copy.lastUpdatedUTC
                    };
                }
                catch (error) {
                    console.log(`Unable to upload image ${file.name}.`)
                    try {
                        await userSession?.deleteFile(indexFile, {
                            wasSigned: false
                        });
                    }
                    catch (e2) {
                        console.log(`Unable to cleanup index file: ${indexFile}.`)
                        console.log(e2);
                    }
                }
            }
        }
        catch (error) {
            console.log(error);
        }
        return ret;
    }

    const validateInfo = () => {
        let ret: boolean = true;
        if (!title || title.trim().length === 0) {
            setTitleError(true);
            setTitleErrorMessage("Required field.")
            ret = false;;
        }
        if (!isValidKeywords()) {
            ret = false;
        }
        if (ret) {
            setTitleError(false);
            setTitleErrorMessage("");
            setKeywordsError(false);
            setKeywordsErrorMessage(keywordsErrorMessage);
        }
        return ret;
    }

    const goNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }

    const saveVideoFiles = async (userSession: UserSession, metaData: MediaMetaData, files: any[]) => {
        let fname = `${metaData.type}/${metaData.id}.index`;

        props.updateProgressCallback(`Uploading index file...`, null);
        let privateKey = '';
        if (!isPublic) {
            privateKey = await createPrivateKey(userSession, metaData.id, metaData.type);
        }
        if (privateKey || isPublic) {
            let data = JSON.stringify(metaData);
            if (privateKey) {
                let publicKey = getPublicKeyFromPrivate(privateKey);
                data = await userSession.encryptContent(data, {
                    publicKey: publicKey
                });
            }
            await userSession.putFile(fname, data, {
                encrypt: false,
                wasString: true,
                contentType: 'application/json'
            })

            let failed = false;
            for (let i = 0; i < files.length; i++) {
                props.updateProgressCallback(`Uploading ${files[i].name} (${i + 1}/${files.length})...`, null);
                if (files[i].name !== 'keys') {
                    let success = await uploadVideo(files[i], metaData, userSession, privateKey)
                    if (!success) {
                        success = await uploadVideo(files[i], metaData, userSession, privateKey);
                    }
                    if (!success) {
                        failed = true;
                        break;
                    }
                }
            }
            if (failed) {
                deleteVideoEntry(metaData, userSession, null, props.updateProgressCallback);
            }
            else {
                await updateMasterIndex(userSession, props.worker, FileOperation.Add, [{ 
                    id: metaData.id,
                    type: metaData.type,
                    isPublic: metaData.isPublic,
                    lastUpdatedUTC: metaData.lastUpdatedUTC
                }]);
            }
        }
    }

    const doUpload = async (result: any) => {
        setUploadFilesError(false)
        setUploadFilesErrorMessage("");
        let metaData: MediaMetaData = result as MediaMetaData;
        if (userSession && metaData) {
            setUploading(true);
            try {
                if (metaData.type === UnencryptedVideosType) {
                    let encodeResult = await convertVideoToHls(metaData, files[0], props.isMobile, !isPublic, props.updateProgressCallback);
                    if (encodeResult.metaData && encodeResult.hlsFiles) {
                        await saveVideoFiles(userSession, encodeResult.metaData, encodeResult.hlsFiles);
                    }
                    else {
                        throw new Error(encodeResult.errorMessage);
                    }
                }
                else if (metaData.type === VideosType) {
                    await saveVideoFiles(userSession, metaData, files);
                }
                else if (metaData.type === ImagesType) {
                    let mediaEntries: FileEntry[] = [];
                    for (let i = 0; i < files.length; i++) {
                        props.updateProgressCallback(`Uploading ${files[i].name} (${i + 1}/${files.length})`, null)
                        if (files[i].name !== 'keys') {
                            let me = await uploadImage(files[i], metaData, userSession);
                            if (me) {
                                mediaEntries.push(me);
                            }
                        }
                    }
                    if (mediaEntries.length > 0) {
                        await updateMasterIndex(userSession, props.worker, FileOperation.Add, mediaEntries);
                    }
                }

                setSuccessfullUploaded(true);
                setUploading(false);
                handleReset();

            } catch (e) {
                console.log(e);
                setUploadFilesError(true)
                setUploadFilesErrorMessage("Upload failed.");
                setSuccessfullUploaded(true);
                setUploading(false);
            }
        }
    }

    const doUpdate = async () => {
        if (userSession) {
            let indexFile = `${type}/${id}.index`;
            let result = await loadBrowseEntry(userSession, indexFile, false);
            let be = result as BrowseEntry;
            if (be) {
                let privateKey = await getPrivateKey('', userSession, be.metaData.id, be.metaData.type);
                if (privateKey) {
                    let kwds: string[] | null = null;
                    if (keywords?.length > 0) {
                        kwds = keywords.split(/\s+/g).filter(x => x.trim().length !== 0);
                    }
                    let nowUTC: Date = getNow();
                    be.metaData.title = title;
                    be.metaData.description = description;
                    be.metaData.keywords = kwds;
                    be.metaData.lastUpdatedUTC = nowUTC;

                    let publicKey = getPublicKeyFromPrivate(privateKey);
                    let encryptedData = await userSession.encryptContent(JSON.stringify(be.metaData), {
                        publicKey: publicKey
                    });
                    await userSession.putFile(indexFile, encryptedData, {
                        encrypt: false,
                        wasString: true,
                        contentType: 'application/json'
                    })

                    updateMasterIndex(userSession, props.worker, FileOperation.Update, [{ 
                        id: be.metaData.id,
                        type: be.metaData.type,
                        isPublic: be.metaData.isPublic,
                        lastUpdatedUTC: be.metaData.lastUpdatedUTC
                    }]);
                    if (type === ImagesType) {
                        if (props.photos) {
                            for (let i = 0; i < props.photos?.length; i++) {
                                let photo = props.photos[i];
                                if (photo.browseEntry.metaData.id === be.metaData.id) {
                                    let newPhoto = { ...photo };
                                    newPhoto.browseEntry.metaData = { ...be.metaData };
                                    newPhoto.browseEntry.age = computeAge(be.metaData.lastUpdatedUTC);
                                    let newPhotos = props.photos.slice();
                                    newPhotos.splice(i, 1);
                                    newPhotos.unshift(newPhoto);
                                    props.imagesLoadedCallback(newPhotos);
                                    break;
                                }
                            }
                        }
                        history.push('/images/browse');
                    }
                    else if (type === MusicType) {
                        if (props.songs) {
                            for (let i = 0; i < props.songs?.length; i++) {
                                let video = props.songs[i];
                                if (video.metaData.id === be.metaData.id) {
                                    let newVideo = { ...video, metaData: be.metaData };
                                    newVideo.age = computeAge(be.metaData.lastUpdatedUTC);
                                    let newSongs = props.songs.slice();
                                    newSongs.splice(i, 1);
                                    newSongs.unshift(newVideo);
                                    props.songsLoadedCallback(newSongs);
                                }
                            }
                        }
                        history.push('/music/browse');
                    }
                    else {
                        if (props.videos) {
                            for (let i = 0; i < props.videos?.length; i++) {
                                let video = props.videos[i];
                                if (video.metaData.id === be.metaData.id) {
                                    let newVideo = { ...video, metaData: be.metaData };
                                    newVideo.age = computeAge(be.metaData.lastUpdatedUTC);
                                    let newVideos = props.videos.slice();
                                    newVideos.splice(i, 1);
                                    newVideos.unshift(newVideo);
                                    props.videosLoadedCallback(newVideos);
                                }
                            }
                        }
                        history.push('/videos/browse');
                    }
                }
            }
        }
    }

    const handleNext = () => {
        if (activeStep === 0) {
            let valid = validateInfo();
            if (!valid) {
                return;
            }
            if (id && steps.length === 1) {
                trackPromise(doUpdate());
            }
            else {
                goNext();
            }
        }
        else if (activeStep === 1) {
            let result = validateUpload(files);
            if (!result || typeof result === "string") {
                setUploadFilesError(true);
                let message: string = "Invalid selection.";
                if (typeof result === "string") {
                    message = result;
                }
                setUploadFilesError(true)
                setUploadFilesErrorMessage(message);
                return;
            }
            trackPromise(doUpload(result));
        }
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleReset = () => {
        setActiveStep(0);
        setFiles([]);
        setTitle("");
        setDescription("");
        setKeywords("");
    };

    useEffect(() => {
        const refresh = async () => {
            let foundExisting: boolean = false;
            if (id && userSession) {
                let indexFile = `${type}/${id}.index`;
                let result = await loadBrowseEntry(userSession, indexFile, false);
                let be = result as BrowseEntry;
                if (be) {
                    foundExisting = true;
                    setTitle(be.metaData.title);
                    setDescription(be.metaData.description);
                    if (be.metaData && be.metaData.keywords && be.metaData.keywords.length > 0) {
                        setKeywords(be.metaData.keywords.join(' '));
                    }
                    setSteps(['Enter search info']);
                }
            }
            if (!foundExisting) {
                setSteps(['Enter search info', 'Upload files']);

            }
        }
        refresh();
    }, [userSession, id, type])

    return (
        <div className={classes.root} style={{ paddingTop: 25, paddingLeft: !props.isMobile ? 40 : 10 }}>
            <Stepper style={{ maxHeight: 800, maxWidth: 450, paddingLeft: 0, paddingRight: 0, paddingTop: 24, paddingBottom: 24 }} activeStep={activeStep}>
                {steps.map((label, index) => {
                    const stepProps: { completed?: boolean } = {};
                    const labelProps: { optional?: React.ReactNode } = {};
                    return (
                        <Step style={{ maxHeight: 800 }} key={label} {...stepProps}>
                            <StepLabel {...labelProps}>{label}</StepLabel>
                        </Step>
                    );
                })}
            </Stepper>
            <div>
                {activeStep === steps.length ? (
                    <div>
                    </div>
                ) : (
                        <div style={{ paddingLeft: 10 }}>
                            <Box style={{ width: '100%', minHeight: 300 }}>
                                <FormControl>
                                    {getStepContent(activeStep)}
                                </FormControl>
                            </Box>
                            <div style={{ paddingTop: 20 }}>
                                <Button disabled={activeStep === 0 || uploading || successfullUploaded} onClick={handleBack} className={classes.button}>
                                    Back
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleNext}
                                    disabled={uploading || successfullUploaded}
                                    className={classes.button}
                                >
                                    {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                                </Button>
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
}
