import React, { useEffect } from 'react';
import { useConnect } from '@blockstack/connect';
import Hls from "hls.js";
import "../browse-videos/BrowseVideos.css";
import { useParams, useHistory } from 'react-router-dom';
import { VideoDescription } from './VideoDescription';
import { useWindowSize } from '../../effects/size-effect';

interface VideoPlayerContext {
  current: any;
}

interface ParamTypes {   id: string; } 

export function VideoPlayer() {
  const { authOptions } = useConnect();
  const { userSession } = authOptions;
  const  {id} = useParams<ParamTypes>();
  const history = useHistory();

  const context: VideoPlayerContext = {
    current: {}
  };

  const [width, height] = useWindowSize('videoParent');

  function process(playlist: any) {
    return context.current.videoKey as ArrayBuffer;
  }
  class customLoader extends Hls.DefaultConfig.loader {

    constructor(config: any) {
      super(config);
      var load = this.load.bind(this);
      this.load = function (context, config, callbacks) {
        if (context.url.endsWith('key.bin')) {
          var onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (response, stats, context) {
            response.data = process(response.data);
            onSuccess(response, stats, context);
          }
        }
        load(context, config, callbacks);
      };
    }
  }

  useEffect(() => {
    let hls: Hls | null;
    const playVideo = async () => {
      if (Hls.isSupported() && userSession) {

        let videoKey = await userSession.getFile(`videos/${id}/key.bin`, {
          decrypt: true
        });
        if (videoKey) {
          context.current.videoKey = videoKey;
          let source = await userSession.getFileUrl(`videos/${id}/master.m3u8`)
          if (source) {
            let video: any = document.getElementById('video');
            hls = new Hls({
              loader: customLoader
            });

            hls.loadSource(source);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function () {
              let playPromise = video.play();
              if (playPromise !== undefined) {
                playPromise.then((_: any) => {
                  // Automatic playback started!
                  // Show playing UI.
                })
                  .catch((error: any) => {
                    // Auto-play was prevented
                    // Show paused UI.
                  });
              }
            });
          }
          else {
            history.push('/');
          }
        }
        else {
          history.push('/');
        }

      }
    }
    playVideo();
    return function cleanup() {
      if (hls) {
        hls.destroy();
      }
    }
  }, [userSession, customLoader, id, history, context]);

  return (
<div>
      <div id="videoParent" style={{ width: "100%", height:"calc(70vh" }}>
        <video id="video" width={width} height={height} style={{ objectFit: "initial" }} controls></video>
      </div>
      <VideoDescription />
    </div>  );
}
