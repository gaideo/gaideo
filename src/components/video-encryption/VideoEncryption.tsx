import React from 'react';
import { Typography, Link, Box, Paper } from '@material-ui/core';
export function VideoEncryption() {

    return (
        <Box style={{marginLeft: '10%', marginRight: '20%'}}>
                <Paper style={{padding: 20}}>
            <Typography variant="h5" paragraph>Encrypt Videos</Typography>
            <Typography variant="subtitle1" paragraph>
                A docker image has been created with all of the necessary tools and scripts to encrypt videos on your PC. 
                Once your video is encrypted you can upload them to your personal Gaia storage by clicking on <Link href="/#/publish">Publish.</Link>
                <br/><br/> 
                If you do not already have a docker hub account you will need to make one, but the docker image is public and free to download.  For instructions on how to get started with video encryption <Link target="_blank" href="https://hub.docker.com/repository/docker/gaideo/gaideo-encrypt">click here.</Link>                        
            </Typography>
            </Paper>
        </Box>
    );

}
