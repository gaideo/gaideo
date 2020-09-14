import React, { useEffect } from 'react';
import 'react-slideshow-image/dist/styles.css'
import { Slide } from 'react-slideshow-image';
import { Box, Icon } from '@material-ui/core';
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight';
import KeyboardArrowLeftIcon from '@material-ui/icons/KeyboardArrowLeft';
import "./SlideShow.css";
import { mobileCheck } from '../../utilities/responsive-utils';

export function SlideShow(props) {
    const slideRef = React.useRef();

    const isMobile = mobileCheck();
    console.log(isMobile);
    const arrowSize = isMobile ? 0 : undefined;
    const paddingSize = isMobile ? 0 : 10;

   
    const goto = (index) => {
        slideRef.current.goTo(index);
    }

    useEffect(() => {
        goto(props.current);
    }, [props]);

    const zoomInProperties = {
        indicators: true,
        scale: 1.4,
        autoplay: false,
        transitionDuration: 300
    }

    return (
        <Box style={{backgroundColor: 'black', display: 'flex', flexDirection:"column", justifyContent: 'space-between' }}>
            <Slide ref={slideRef} easing="ease" {...zoomInProperties} 
              prevArrow={(
                <Icon style={{color: 'white', width:arrowSize, height:arrowSize, cursor: 'pointer', padding: paddingSize}}><KeyboardArrowLeftIcon fontSize="large"/></Icon>
                )}
              nextArrow={(
                <Icon style={{color: 'white', width:arrowSize, height:arrowSize, cursor: 'pointer', padding: paddingSize}}><KeyboardArrowRightIcon fontSize="large"/></Icon>
                )}
              >
                {props.images.map((each, index) => (    
                    <div key={index} className="each-slide">
                    <div>
                        <div style={{marginLeft:'auto', marginRight: 'auto'}}>
                        <img style={{ height: '80vh'}} alt={each.title} src={each.src} />
                        </div>
                    </div>
                  </div>
                ))}
            </Slide>
        </Box>)
}