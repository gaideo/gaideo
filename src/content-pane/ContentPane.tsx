import React from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';
import { VideoPlayer } from '../components/video-player/VideoPlayer';
import { BrowseVideos } from '../components/browse-videos/BrowseVideos';
import PublishVideo from '../components/publish-video/PublishVideo';
import { VideoEncryption } from '../components/video-encryption/VideoEncryption';
import { ContactUs } from '../components/contact-us/ContactUs';

export function ContentPane() {

    return (
        <div style={{ paddingTop: 60, paddingLeft: 0, paddingRight: 0 }}>
            <Switch>
                <Route path="/videos/show/:id">
                    <VideoPlayer />
                </Route>
                <Route path="/videos/browse">
                <BrowseVideos />
                </Route>
                <Route path="/publish">
                    <PublishVideo />
                </Route>
                <Route path="/encrypt">
                    <VideoEncryption />
                </Route>
                <Route path="/contactus">
                    <ContactUs/>
                </Route>
                <Route path="/">
                    <Redirect to="/videos/browse" />
                </Route>
            </Switch>
        </div>
    );
}