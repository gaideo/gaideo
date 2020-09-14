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
import { deleteVideoEntry, loadBrowseEntry } from '../../utilities/data-utils';
import { getNow } from '../../utilities/time-utils';
import { makeUUID4 } from 'blockstack';
import { BrowseEntry } from '../../models/browse-entry';

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

export default function PublishVideo() {
    const keywordsMessage: string = 'Letters, numbers, special characters # or -';
    type ValidateUploadResultDelegate = (filesToUpload: string[]) => MediaEntry | string;

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

    const isImageName = (name: string, lowerCase: boolean) => {
        let lname: string = name;
        if (lowerCase) {
            lname = name.toLocaleLowerCase();
        }
        return lname.endsWith('.jpg')
            || lname.endsWith('.jpeg')
            || lname.endsWith('.png');
    }

    const validateUpload: ValidateUploadResultDelegate = (filesToUpload) => {
        let hasError: boolean = false;
        if (!filesToUpload || filesToUpload.length === 0) {
            hasError = true;
        }
        let foundKey: boolean = false;
        let previewImageName: string | null = null;
        let imageCount: number = 0;
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
            if (!lname.endsWith('.m3u8')
                && !lname.endsWith('keys')
                && lname !== 'key.bin'
                && !lname.endsWith('.ts')
                && !isImageName(lname, false)) {
                hasError = true;
                break;
            }
            if (isImageName(lname, false)) {
                imageCount++;
            }
            if (lname !== 'keys') {
                manifest.push(`${name}`);
            }
            if (lname === 'key.bin') {
                foundKey = true;
            }
            if (lname.endsWith('_preview.jpg')) {
                previewImageName = name;
            }
        }
        if (imageCount < filesToUpload.length && (!foundKey || !previewImageName)) {
            hasError = true;
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
            else {
                if (previewImageName && previewImageName.trim().length > 0) {
                    id = `${id}_${previewImageName.replace('_preview.jpg', '')}`
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
        console.log('error here');
        return 'Please select only the files in the root of your HLS directory.';
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

    const getImageFileContentType = (name: string) => {
        let lowerName = name.toLocaleLowerCase();
        if (lowerName.endsWith(".png")) {
            return "image/png";
        }
        else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        else {
            return "application/octet-stream"
        }
    }

    const uploadVideo = async (file: any, mediaEntry: MediaEntry, userSession: any) => {
        try {
            let name: string = `videos/${mediaEntry.id}/${file.name}`;
            await userSession.putFile(name, file, {
                encrypt: file.name === 'key.bin' || file.name.endsWith('_preview.jpg'),
                wasString: false,
                contentType: getVideoFileContentType(file.name)
            })
            return true;

        }
        catch (error) {
            console.log(`Unable to upload video file: ${file.name}`);
            console.log(error);
        }
        return false;
    }

    const uploadImages = async (file: any, mediaEntry: MediaEntry, userSession: any) => {
        try {
            let copy = { ...mediaEntry };
            copy.id = `${mediaEntry.id}_${file.name}`;
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
                let name: string = `images/${mediaEntry.id}/${file.name}`;
                await userSession.putFile(name, file, {
                    encrypt: true,
                    wasString: false,
                    contentType: getImageFileContentType(file.name)
                })
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

    const doUpload = async (result: any) => {
        setUploadFilesError(false)
        setUploadFilesErrorMessage("");
        let mediaEntry: MediaEntry = result as MediaEntry;
        if (userSession && mediaEntry) {
            setUploading(true);
            try {
                if (mediaEntry.mediaType === MediaType.Video) {
                    await userSession.putFile('videos/' + mediaEntry.id + '.index', JSON.stringify(mediaEntry), {
                        encrypt: true,
                        wasString: true,
                        sign: true
                    });
                    let failed = false;
                    for (let i = 0; i < files.length; i++) {
                        if (files[i].name !== 'keys') {
                            let success = await uploadVideo(files[i], mediaEntry, userSession)
                            if (!success) {
                                success = await uploadVideo(files[i], mediaEntry, userSession);
                            }
                            if (!success) {
                                failed = true;
                                break;
                            }
                        }
                    }
                    if (failed) {
                        deleteVideoEntry(mediaEntry, userSession);
                    }
                }
                else if (mediaEntry.mediaType === MediaType.Images) {
                    for (let i = 0; i < files.length; i++) {
                        if (files[i].name !== 'keys') {
                            await uploadImages(files[i], mediaEntry, userSession)
                        }
                    }
                }

                setSuccessfullUploaded(true);
                setUploading(false);
                if (mediaEntry.mediaType === MediaType.Images) {
                    history.push("/images/browse");
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
                if (mediaType === MediaType.Images) {
                    history.push('/images/browse');
                }
                else {
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
        <div className={classes.root} style={{padding: 24}}>
            <Stepper style={{ maxHeight: 800 }} activeStep={activeStep}>
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
                        <div>
                            <Box style={{ width: '100%', minHeight: 300, paddingLeft:30 }}>
                                <FormControl>
                                    {getStepContent(activeStep)}
                                </FormControl>
                            </Box>
                            <div style={{ paddingTop: 20, paddingLeft: 30 }}>
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
