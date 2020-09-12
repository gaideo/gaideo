import React, { useEffect } from 'react';
import 'react-slideshow-image/dist/styles.css'
import { Zoom } from 'react-slideshow-image';
import CloseIcon from '@material-ui/icons/CloseOutlined';
import { Box, IconButton } from '@material-ui/core';

export function SlideShow(props) {
    const slideRef = React.useRef();

    const goto = (index) => {
        slideRef.current.goTo(index);
    }

    useEffect(() => {
        goto(props.current);
    }, [props]);

    const zoomInProperties = {
        indicators: true,
        scale: 1.4
    }

    return (
        <Box style={{display: 'flex', flexDirection:"column", justifyContent: 'space-between' }}>
            <IconButton style={{width: 100, alignSelf: 'flex-end'}} onClick={() => { props.closeSlideshowCallback() }}>
                <CloseIcon/>
            </IconButton>
            <Zoom ref={slideRef} {...zoomInProperties}>
                {props.images.map((each, index) => (
                    <div style={{ height: '80vh' }} key={index}>
                        <img alt={each.title} src={each.src} />
                    </div>
                ))}
            </Zoom>
        </Box>)
}