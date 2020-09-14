import React, { useEffect } from 'react';
import 'react-slideshow-image/dist/styles.css'
import { Slide } from 'react-slideshow-image';
import { Box, Icon } from '@material-ui/core';
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight';
import KeyboardArrowLeftIcon from '@material-ui/icons/KeyboardArrowLeft';
import "./SlideShow.css";
import { mobileCheck } from '../../utilities/responsive-utils';
import { useWindowSize } from '../../effects/size-effect';

export function SlideShow(props) {
    const isMobile = mobileCheck();
    const arrowSize = isMobile ? 0 : undefined;
    const paddingSize = isMobile ? 0 : 10;

   
    const zoomInProperties = {
        indicators: true,
        scale: 1.4,
        autoplay: false,
        transitionDuration: 300
    }
    const [width, height] = useWindowSize('imageParent');

    const getImageSize = (aspectWidth, aspectHeight) => {
        let x = height * aspectWidth / aspectHeight;
        let y = width - x;
        let nw = width - y;
        let nh = height;
        if (nw > width) {
            nw = width;
            let a = aspectHeight * nw / aspectWidth;
            let b = height - a;
            nh  = height - b;
        } 
       
        return [nw, nh];
    }

    return (
        <Box style={{backgroundColor: 'black', display: 'flex', flexDirection:"column", justifyContent: 'space-between' }}>
            <Slide defaultIndex={props.current} indicator={false} easing="ease" {...zoomInProperties} 
              prevArrow={(
                <Icon style={{color: 'white', width:arrowSize, height:arrowSize, cursor: 'pointer', padding: paddingSize}}><KeyboardArrowLeftIcon fontSize="large"/></Icon>
                )}
              nextArrow={(
                <Icon style={{color: 'white', width:arrowSize, height:arrowSize, cursor: 'pointer', padding: paddingSize}}><KeyboardArrowRightIcon fontSize="large"/></Icon>
                )}
              >
                {props.images.map((each, index) => (    
                    <div id="imageParent" key={index} className="each-slide">
                    <div>
                        <div style={{height: '80vh', margin:'auto', display: 'flex', alignItems: 'center'}}>
                            <div>
                            <img  width={getImageSize(each.aspectWidth, each.aspectHeight)[0]} height={getImageSize(each.aspectWidth, each.aspectHeight)[1]} alt={each.title} src={each.src} />
                            </div>
                        </div>
                    </div>
                  </div>
                ))}
            </Slide>
        </Box>)
}