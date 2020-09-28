import React, { Fragment, useState, useEffect } from 'react';
import "./PublishMedia.css";
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { TextField, FormControl, Box, FormHelperText } from '@material-ui/core';
import Dropzone from '../dropzone/Dropzone';
import { MediaEntry, MediaType } from '../../models/media-entry';
import { useConnect } from '@blockstack/connect';
import { trackPromise } from 'react-promise-tracker';
import { useHistory, useParams } from 'react-router-dom';
import { createHashAddress, deleteVideoEntry, createPrivateKey, loadBrowseEntry, updateMasterIndex, getPrivateKey } from '../../utilities/data-utils';
import { computeAge, getNow } from '../../utilities/time-utils';
import { getPublicKeyFromPrivate, makeUUID4, UserSession } from 'blockstack';
import { BrowseEntry } from '../../models/browse-entry';
import { Photo } from '../../models/photo';
import { ImagesLoadedCallback, UpdateProgressCallback, VideosLoadedCallback } from '../../models/callbacks';
import { readBinaryFile } from '../../utilities/file-utils';
import { MediaFileEntry } from '../../models/media-file-entry';
import { computeNameFromImageFile, encryptVideo } from '../../utilities/ffmpeg-utils';

interface ParamTypes { id: string; }

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
    videosLoadedCallback: VideosLoadedCallback;
    imagesLoadedCallback: ImagesLoadedCallback;
    isMobile: boolean;
    updateProgressCallback: UpdateProgressCallback;
}

export default function PublishVideo(props: PublishVideoProps) {
    const keywordsMessage: string = 'Letters, numbers, special characters # or -';
    type ValidateUploadResultDelegate = (filesToUpload: any[]) => MediaEntry | string;

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
    const { id } = useParams<ParamTypes>();
    const [steps, setSteps] = useState(Array<string>());

    const onFilesAdded = (files: any) => {
        setFiles(files);
    }

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
                else if (imageCount === 0 && unencryptedVideoCount === 0 && (!foundKey || !previewImageName)) {
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
                    const imagesEntry: MediaEntry = {
                        id: id,
                        title: title,
                        description: description,
                        keywords: kwds,
                        userName: userData?.username,
                        identityAddress: userData?.identityAddress,
                        manifest: manifest,
                        createdDateUTC: nowUTC,
                        lastUpdatedUTC: nowUTC,
                        mediaType: MediaType.Images
                    }
                    return imagesEntry;
                }
                else if (unencryptedVideoCount === 1) {
                    const mediaEntry: MediaEntry = {
                        id: id,
                        title: title,
                        description: description,
                        keywords: kwds,
                        userName: userData?.username,
                        identityAddress: userData?.identityAddress,
                        manifest: manifest,
                        createdDateUTC: nowUTC,
                        lastUpdatedUTC: nowUTC,
                        mediaType: MediaType.UnencryptedVideo,
                        previewImageName: computeNameFromImageFile(filesToUpload[0].name)
                    }
                    return mediaEntry;
                }
                else {
                    if (previewImageName && previewImageName.trim().length > 0) {
                        id = createHashAddress([id, previewImageName.replace('_preview.jpg', '')]);
                    }
                    const mediaEntry: MediaEntry = {
                        id: id,
                        title: title,
                        description: description,
                        keywords: kwds,
                        userName: userData?.username,
                        identityAddress: userData?.identityAddress,
                        manifest: manifest,
                        createdDateUTC: nowUTC,
                        lastUpdatedUTC: nowUTC,
                        mediaType: MediaType.Video,
                        previewImageName: previewImageName ? `videos/${id}/${previewImageName}` : ''
                    }
                    return mediaEntry;
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

    const uploadVideo = async (file: any, mediaEntry: MediaEntry, userSession: UserSession, keyExists: boolean) => {
        try {
            let name: string = `videos/${mediaEntry.id}/${file.name}`;
            if (needEncryptVideoFile(file.name)) {
                let data;
                if (file.data) {
                    data = file.data;
                }
                else {
                    data = await readBinaryFile(file);
                }
                let privateKey: string | undefined | null;
                if (keyExists) {
                    privateKey = await getPrivateKey(userSession, userSession.loadUserData(), mediaEntry.id, MediaType.Video);
                }
                else {
                    privateKey = await createPrivateKey(userSession, mediaEntry.id, MediaType.Video);
                }
                if (privateKey) {
                    let buffer = Buffer.from(new Uint8Array(data));
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

    const uploadImage = async (file: any, mediaEntry: MediaEntry, userSession: any) => {
        let ret: MediaFileEntry | null = null;
        try {
            let copy = { ...mediaEntry };
            copy.id = createHashAddress([mediaEntry.id, file.name]);
            copy.manifest = [file.name];
            if (mediaEntry.manifest.length > 1) {
                copy.title = `${title} (${file.name})`;
            }
            let indexFile = `images/${copy.id}.index`;
            await userSession.putFile(indexFile, JSON.stringify(copy), {
                encrypt: true,
                wasString: true,
                sign: true
            });

            try {
                let name: string = `images/${copy.id}/${file.name}`;

                let data = await readBinaryFile(file);
                let privateKey = await createPrivateKey(userSession, copy.id, MediaType.Images);
                let buffer = Buffer.from(new Uint8Array(data));
                let publicKey = getPublicKeyFromPrivate(privateKey);
                let encryptedData = await userSession.encryptContent(buffer, {
                    publicKey: publicKey
                });
                await userSession.putFile(name, encryptedData, {
                    encrypt: false,
                    wasString: true,
                    contentType: 'application/json'
                })

                ret = {
                    mediaEntry: copy,
                    indexFile: indexFile
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

    const saveVideoFiles = async (userSession: UserSession, mediaEntry: MediaEntry, files: any[]) => {
        let fname = `videos/${mediaEntry.id}.index`;

        props.updateProgressCallback(`Uploading index file...`, null);
        await userSession.putFile(fname, JSON.stringify(mediaEntry), {
            encrypt: true,
            wasString: true,
            sign: true
        });
        let failed = false;
        let keyExists = false;
        for (let i = 0; i < files.length; i++) {
            props.updateProgressCallback(`Uploading ${files[i].name} (${i+1}/${files.length})...`, null);
            if (files[i].name !== 'keys') {
                let success = await uploadVideo(files[i], mediaEntry, userSession, keyExists)
                if (!success) {
                    success = await uploadVideo(files[i], mediaEntry, userSession, keyExists);
                }
                if (!success) {
                    failed = true;
                    break;
                }
                if (needEncryptVideoFile(files[i].name)) {
                    keyExists = true;
                }
            }
        }
        if (failed) {
            deleteVideoEntry(mediaEntry, userSession, null);
        }
        else {
            await updateMasterIndex(userSession, [{ indexFile: fname, mediaEntry: mediaEntry }]);
            props.worker?.postMessage({
                message: "cacheindexes",
                indexFiles: [fname]
            });
        }
    }

    const doUpload = async (result: any) => {
        setUploadFilesError(false)
        setUploadFilesErrorMessage("");
        let mediaEntry: MediaEntry = result as MediaEntry;
        if (userSession && mediaEntry) {
            setUploading(true);
            try {
                if (mediaEntry.mediaType === MediaType.UnencryptedVideo) {
                    let encryptResult = await encryptVideo(mediaEntry, files[0], props.updateProgressCallback);
                    if (encryptResult.mediaEntry && encryptResult.hlsFiles) {
                        await saveVideoFiles(userSession, encryptResult.mediaEntry, encryptResult.hlsFiles);
                    }
                    else {
                        Promise.reject(encryptResult.errorMessage);
                    }
                }
                else if (mediaEntry.mediaType === MediaType.Video) {
                    await saveVideoFiles(userSession, mediaEntry, files);
                }
                else if (mediaEntry.mediaType === MediaType.Images) {
                    let mediaEntries: MediaFileEntry[] = [];
                    for (let i = 0; i < files.length; i++) {                        
                        props.updateProgressCallback(`Uploading ${files[i].name} (${i+1}/${files.length})`, null)
                        if (files[i].name !== 'keys') {                            
                            let me = await uploadImage(files[i], mediaEntry, userSession);
                            if (me) {
                                mediaEntries.push(me);
                            }
                        }
                    }
                    if (mediaEntries.length > 0) {
                        await updateMasterIndex(userSession, mediaEntries);
                        props.worker?.postMessage({
                            message: 'cacheindexes',
                            indexFiles: mediaEntries.map(x => x.indexFile)
                        })
                    }
                }

                setSuccessfullUploaded(true);
                setUploading(false);
                if (mediaEntry.mediaType === MediaType.Images) {
                    history.push("/images/browse");
                }
                else if (mediaEntry.mediaType === MediaType.UnencryptedVideo) {
                    history.push("/videos/browse");
                }
                else {
                    history.push("/videos/browse");
                }
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
            let mediaType = MediaType.Video;
            let indexFile = `videos/${id}.index`;
            if (isImageName(id, true)) {
                mediaType = MediaType.Images;
                indexFile = `images/${id}.index`
            }
            let result = await loadBrowseEntry(userSession, indexFile, false, mediaType);
            let be = result as BrowseEntry;
            if (be) {
                let kwds: string[] | null = null;
                if (keywords?.length > 0) {
                    kwds = keywords.split(/\s+/g).filter(x => x.trim().length !== 0);
                }
                let nowUTC: Date = getNow();
                be.mediaEntry.title = title;
                be.mediaEntry.description = description;
                be.mediaEntry.keywords = kwds;
                be.mediaEntry.lastUpdatedUTC = nowUTC;
                await userSession.putFile(indexFile, JSON.stringify(be.mediaEntry), {
                    encrypt: true,
                    sign: true,
                    wasString: true
                });
                updateMasterIndex(userSession, [{ indexFile: indexFile, mediaEntry: be.mediaEntry }]);
                props.worker?.postMessage({
                    message: "updatecache",
                    indexFile: indexFile
                });
                if (mediaType === MediaType.Images) {
                    if (props.photos) {
                        for (let i = 0; i < props.photos?.length; i++) {
                            let photo = props.photos[i];
                            if (photo.browseEntry.mediaEntry.id === be.mediaEntry.id) {
                                let newPhoto = { ...photo };
                                newPhoto.browseEntry.mediaEntry = { ...be.mediaEntry };
                                newPhoto.browseEntry.age = computeAge(be.mediaEntry.lastUpdatedUTC);
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
                else {
                    if (props.videos) {
                        for (let i = 0; i < props.videos?.length; i++) {
                            let video = props.videos[i];
                            if (video.mediaEntry.id === be.mediaEntry.id) {
                                let newVideo = { ...video, mediaEntry: be.mediaEntry };
                                newVideo.age = computeAge(be.mediaEntry.lastUpdatedUTC);
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
                let mediaType = MediaType.Video;
                let indexFile = `videos/${id}.index`;
                if (isImageName(id, true)) {
                    mediaType = MediaType.Images;
                    indexFile = `images/${id}.index`
                }
                let result = await loadBrowseEntry(userSession, indexFile, false, mediaType);
                let be = result as BrowseEntry;
                if (be) {
                    foundExisting = true;
                    setTitle(be.mediaEntry.title);
                    setDescription(be.mediaEntry.description);
                    if (be.mediaEntry && be.mediaEntry.keywords && be.mediaEntry.keywords.length > 0) {
                        setKeywords(be.mediaEntry.keywords.join(' '));
                    }
                    setSteps(['Enter search info']);
                }
            }
            if (!foundExisting) {
                setSteps(['Enter search info', 'Upload files']);

            }
        }
        refresh();
    }, [userSession, id])

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
                        <Typography className={classes.instructions}>
                            Publish completed - Do you want to publish another video?
                        </Typography>
                        <Button onClick={handleReset} className={classes.button}>
                            Publish Another Video
                        </Button>
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
