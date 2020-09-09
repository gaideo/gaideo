import React, { Fragment } from 'react';
import "./PublishVideo.css";
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { TextField, FormControl, Box, FormHelperText } from '@material-ui/core';
import Dropzone from '../dropzone/Dropzone';
import { VideoEntry } from '../../models/video-entry';
import { useConnect } from '@blockstack/connect';
import { trackPromise } from 'react-promise-tracker';
import { useHistory } from 'react-router-dom';

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
    type ValidateUploadResultDelegate = (filesToUpload: string[]) => VideoEntry | string;

    const classes = useStyles();
    const [activeStep, setActiveStep] = React.useState(0);
    const steps = ['Enter search info', 'Upload files'];
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
                    <div className="Files" style={{maxHeight: 500}}>
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

    const validateUpload: ValidateUploadResultDelegate = (filesToUpload) => {
        let hasError: boolean = false;
        if (!filesToUpload || filesToUpload.length === 0) {
            hasError = true;
        }
        let foundKey: boolean = false;
        let foundPreview: boolean = false;
        let id: string = '';
        let manifest: string[] = [];
        for (let i = 0; i < filesToUpload.length; i++) {
            let f: any = filesToUpload[i];
            if (!f.name) {
                hasError = true;
                break;
            }
            let name: string = f.name;
            if (!name.endsWith('.m3u8')
                && name !== 'key.bin'
                && !name.endsWith('.ts')
                && !name.endsWith('_preview.jpg')) {
                hasError = true;
                break;
            }
            manifest.push(name);
            if (name === 'key.bin') {
                foundKey = true;
            }
            if (name.endsWith('_preview.jpg')) {
                foundPreview = true;
                id = name.replace('_preview.jpg', '');
            }
        }
        if (!foundKey || !foundPreview || id.trim().length === 0) {
            hasError = true;
        }

        if (!hasError
            && userData
            && (userData.username?.length > 0 || userData?.identityAddress?.length > 0)) {
            let kwds: string[] | null = null;
            if (keywords?.length > 0) {
                kwds = keywords.split(/\s+/).filter(x => x.trim().length === 0);
            }
            const ret: VideoEntry = {
                id: id,
                title: title,
                description: description,
                previewImage: '',
                isPublic: false,
                keywords: kwds,
                userName: userData?.username,
                identityAddress: userData?.identityAddress,
                manifest: manifest
            }
            return ret;
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

    const sendRequest = async (file: any, videoEntry: VideoEntry, userSession: any) => {
        try {
            let name: string = `videos/${videoEntry.id}/${file.name}`;
            await userSession.putFile(name, file, {
                encrypt: file.name === 'key.bin' || file.name.endsWith('_preview.jpg'),
                wasString: false,
                contentType: getVideoFileContentType(file.name)
            })

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
        let videoEntry: VideoEntry = result as VideoEntry;
        if (userSession && videoEntry) {
            setUploading(true);            
            try {

                await userSession.putFile('videos/' + videoEntry.id + '.index', JSON.stringify(videoEntry), {
                    encrypt: true,
                    wasString: true,
                    sign: true
                });
                for (let i=0; i<files.length; i++) {
                    await sendRequest(files[i], videoEntry, userSession)                            
                }

                setSuccessfullUploaded(true);
                setUploading(false);
                history.push("/");
            } catch (e) {
                console.log(e);
                setUploadFilesError(true)
                setUploadFilesErrorMessage("Upload failed.");
                setSuccessfullUploaded(true);
                setUploading(false);
            }
        }
    }

    const handleNext = () => {
        if (activeStep === 0) {
            let valid = validateInfo();
            if (!valid) {
                return;
            }
            goNext();
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

    return (
        <div className={classes.root}>
            <Stepper style={{maxHeight: 800}} activeStep={activeStep}>
                {steps.map((label, index) => {
                    const stepProps: { completed?: boolean } = {};
                    const labelProps: { optional?: React.ReactNode } = {};
                    return (
                        <Step style={{maxHeight: 800}} key={label} {...stepProps}>
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
                            <Box style={{width: '100%', minHeight: 300 }}>
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
