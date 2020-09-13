import React, { useEffect } from 'react';
import 'react-slideshow-image/dist/styles.css'
import { Slide } from 'react-slideshow-image';
import CloseIcon from '@material-ui/icons/CloseOutlined';
import { Box, Icon, IconButton } from '@material-ui/core';
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight';
import KeyboardArrowLeftIcon from '@material-ui/icons/KeyboardArrowLeft';

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
        scale: 1.4,
        autoplay: false
    }

    return (
        <Box style={{display: 'flex', flexDirection:"column", justifyContent: 'space-between' }}>
            <IconButton style={{width: 100, alignSelf: 'flex-end'}} onClick={() => { props.closeSlideshowCallback() }}>
                <CloseIcon/>
            </IconButton>
            <Slide ref={slideRef} {...zoomInProperties} 
              prevArrow={(<Icon style={{cursor: 'pointer', paddingRight: 10}}><KeyboardArrowLeftIcon fontSize="large"/></Icon>)}
              nextArrow={(<Icon style={{cursor: 'pointer', paddingRight: 10}}><KeyboardArrowRightIcon fontSize="large"/></Icon>)}
              >
                {props.images.map((each, index) => (    
                    <div key={index} className="each-slide" style={{marginLeft: 'auto', marginRight: 'auto'}}>
                    <div style={{'backgroundImage': `url(${props.images[index]})`,marginLeft: 'auto', marginRight: 'auto'}}>
                    <img style={{ height: '80vh', maxWidth: '100%',marginLeft: 'auto', marginRight: 'auto'}} alt={each.title} src={each.src} />
                    </div>
                  </div>
                ))}
            </Slide>
        </Box>)
}