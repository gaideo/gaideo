import React from 'react';
import { Typography, Link } from '@material-ui/core';
export function VideoEncryption() {
    return (        
        <Typography paragraph>
            A docker image has been created with all of the necessary tools and scripts to encrypt videos on your PC. 
            Once your video is encrypted you can upload them to your personal Gaia storage by clicking on <Link href="/#/publish">Publish.</Link>
            <br/><br/> 
            For instructions on how to get started with video encryption go <Link target="_blank" href="https://hub.docker.com/repository/docker/gaideo/gaideo-encrypt">click here.</Link>                        
        </Typography>
    );

}
