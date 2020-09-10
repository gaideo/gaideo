import React from 'react';
import { Typography, Link } from '@material-ui/core';
export function ContactUs() {
    return (        
        <Typography paragraph>
            Gaideo is a work in progress with many new features on the way.  If you have ideas for improvements or encounter any bugs, please email us at <Link href="mailto:support@gaideo.com">Gaideo Support</Link>
        </Typography>
    );

}
