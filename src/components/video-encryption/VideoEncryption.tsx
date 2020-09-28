import React from 'react';
import { Typography, Link, Box, Paper } from '@material-ui/core';
export function VideoEncryption() {

    return (
        <Box style={{marginLeft: '5%', marginRight: '5%'}}>
                <Paper style={{padding: 20}}>
            <Typography variant="h5" paragraph>Encrypt Videos</Typography>
            <Typography variant="subtitle1" paragraph>
                Gaidea supports encrypting .mp4, .mov, and .avi video files natively in the browser using a javascript library built from ffmpeg.  This method works but the performance is significantly slower than encrypting with our docker image. 
                Although it requires more technical ability, it may be worth learning this method if your videos are very large.
                <br/><br/>
                A docker image has been created with all of the necessary tools and scripts to encrypt videos on your PC. 
                Once your video is encrypted you can upload them to your personal Gaia storage by clicking on <Link href="/#/publish">Publish.</Link>
                <br/><br/> 
                If you do not already have a docker hub account you will need to make one, but the docker image is public and free to download.  For instructions on how to get started with video encryption using docker <Link target="_blank" href="https://hub.docker.com/repository/docker/gaideo/gaideo-encrypt">click here.</Link>                        
            </Typography>
            </Paper>
        </Box>
    );

}
