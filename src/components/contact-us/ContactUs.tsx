import React from 'react';
import { Typography, Link, Box, Paper } from '@material-ui/core';
export function ContactUs() {
    return (        
        <Box style={{marginLeft: '10%', marginRight: '20%'}}>
            <Paper style={{padding: 20}}>
            <Typography variant="h5" paragraph>Contact Us</Typography>
            <Typography variant="subtitle1" paragraph>
                Gaideo is a work in progress with many new features on the way.  If you have ideas for improvements or encounter any bugs, please email us at <Link href="mailto:support@gaideo.com">Gaideo Support</Link>
            </Typography>
            </Paper>
        </Box>
    );

}
