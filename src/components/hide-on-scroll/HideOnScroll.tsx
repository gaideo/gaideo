import React from 'react';
import { Slide, useScrollTrigger } from "@material-ui/core";

interface HideOnScrollProps {
    children: React.ReactElement;
}

export function HideOnScroll(props: HideOnScrollProps) {
    const { children } = props;
    const trigger = useScrollTrigger();

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            {children}
        </Slide>
    );
}    
