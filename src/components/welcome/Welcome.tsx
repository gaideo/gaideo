import React from 'react';
import { Typography, Link, Box, Paper } from '@material-ui/core';

export function Welcome() {
    return (        
        <Box style={{marginLeft: '10%', marginRight: '20%', color: 'white'}}>
            <Paper style={{padding: 20}}>

            <Typography variant="h5" paragraph>Background</Typography>
            <Typography variant="subtitle1" paragraph>
                We are living in an information age. 
                In the early days of social media, the freedom to connect with people from all over the world started a revolution of consciousness. 
                We now know more about each other than ever before, good and bad. Knowledge provides us with understanding and allows us to grow and evolve. 
                Unfortunately, the price of that knowledge came at a hidden cost. 
                Before we knew the cost it was too late and our information became a commodity that big businesses could exploit to make money at our expense. The choices given to us up until this point has been trading one big company to store and control our data with another.
            </Typography>
            <Typography variant="h5" paragraph>The Mission</Typography>
            <Typography variant="subtitle1" paragraph>
                Gaideo is a mission to incorporate all of the good things about social media. Community. Sharing. Learning. Creativity. 
                And remove all possibilites of the bad things about social media. Greed. Exploitation. Censorship. 
                We need to start with a platform that respects the rights of each individual to own their data, and allow them to control exactly how it will be shared with the rest of the world. 
                Security is a first-class concept to protect all user's data by default without having to change a hidden setting.
            </Typography>
            <Typography variant="h5" paragraph>No Secrets</Typography>
            <Typography variant="subtitle1" paragraph>
                All of the <Link href="https://github.com/gaideo/gaideo">source code</Link> used to produce gaideo.com is open source. 
                There are no secrets about how your data is being stored and accessed. 
                The backbone of all the data storage is built on <Link href="https://github.com/blockstack/gaia">Blockstack's Gaia technology</Link>, an open source blockchain with a storage system that encrypts each user's data, and allows them to control both the content and its location at any time.
            </Typography>
            <Typography variant="h5" paragraph>The Pledge</Typography>
            <Typography variant="subtitle1" paragraph>
                We will not charge you money for this site. 
                All of our content will be encrypted including videos. 
                We will not use your data for any business purpose. 
                We will help you build digital communities to connect and share with exactly the people you want to and no more. 
                Welcome aboard!
            </Typography>
            </Paper>
        </Box>
    );

}
