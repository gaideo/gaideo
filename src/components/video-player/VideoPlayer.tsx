import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useConnect } from '@blockstack/connect';
import Hls from "hls.js";
import "../browse-videos/BrowseVideos.css";
import { useParams, useLocation } from 'react-router-dom';
import { VideoDescription } from './VideoDescription';
import { getEncryptedFile } from '../../utilities/gaia-utils';
import { getImageSize } from '../../utilities/image-utils';
import { VideosType } from '../../utilities/media-utils';

interface VideoPlayerContext {
  current: any;
}

interface ParamTypes {
  id: string;
  owner?: string;
  access?: string
}

interface VideoPlayerProps {
  isMobile: boolean
}

export function VideoPlayer(props: VideoPlayerProps) {
  const { authOptions } = useConnect();
  const { userSession } = authOptions;
  const { access, id, owner } = useParams<ParamTypes>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const location = useLocation();
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [showDescription, setShowDescription] = useState(false);


  useEffect(() => {

    const getPath = () => {
      let ret: string | null = null;
      const pathRegex = /\?path=([0-9a-zA-Z./]+)/g;
      const pathResult = pathRegex.exec(location.search);
      if (pathResult?.length === 2) {
        ret = pathResult[1];
        if (!ret.startsWith('/')) {
          ret = `/${ret}`;
        }
        if (!ret.endsWith('/')) {
          ret += `/`
        }
      }
      return ret;
    }

    const setSize = () => {
      const widthRegex = /width=([0-9]{3,5})/g
      const heightRegex = /height=([0-9]{3,5})/g
      const heightResult = heightRegex.exec(location.search);
      if (heightResult?.length === 2) {
        const widthResult = widthRegex.exec(location.search);
        if (widthResult?.length === 2) {
          const size = getImageSize(parseInt(widthResult[1]), parseInt(heightResult[1]), 1280, 720);
          setWidth(size[0]);
          setHeight(size[1]);

        }
      }
    }

    const path = getPath();

    if (path) {
      if (location.search && id && owner && access) {
        const validIDRegex = /^[0-9a-zA-Z]+$/g;
        const validHostRegex = /^[0-9a-zA-Z.]+$/g;
        let source: string | null = null;
        let hls: Hls | null;

        if (owner && id
          && validIDRegex.test(id)
          && validHostRegex.test(owner)) {
          setSize();
          source = `https://${owner}${path}videos/${id}`;
          if (!source.endsWith("/")) {
            source += '/';
          }
          source = `${source}master.m3u8`;
          console.log(source);
        }
        if (source && videoRef?.current) {
          if (Hls.isSupported()) {
            hls = new Hls({
            });

            hls.loadSource(source);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, function () {
              if (videoRef.current) {
                let playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.then((_: any) => {
                  })
                    .catch((error: any) => {
                    });
                }
              }
            });
          }
          else {
            const videoElem = videoRef.current;
            videoElem.src = source;
          }
        }

      }
    }
  }, [access, owner, location.search, id])

  useEffect(() => {

    const getPath = () => {
      let ret: string | null = null;
      const pathRegex = /\?path=([0-9a-zA-Z./]+)/g;
      const pathResult = pathRegex.exec(location.search);
      if (pathResult?.length === 2) {
        ret = pathResult[1];
        if (!ret.startsWith('/')) {
          ret = `/${ret}`;
        }
        if (!ret.endsWith('/')) {
          ret += `/`
        }
      }
      return ret;
    }

    let hls: Hls | null;
    const context: VideoPlayerContext = {
      current: {}
    };

    function process(playlist: any) {
      return context.current.videoKey as ArrayBuffer;
    }

    const path = getPath();
    if (userSession?.isUserSignedIn() && !path) {
      setShowDescription(true);

      class customLoader extends Hls.DefaultConfig.loader {

        constructor(config: any) {
          super(config);
          var load = this.load.bind(this);
          var stats: any = {};
          this.load = async function (context, config, callbacks) {
            if (context.url.endsWith('key.bin')) {
              var onSuccess = callbacks.onSuccess;
              onSuccess({
                data: process(null),
                url: `${document.location.origin}/key.bin`,
              }, stats, context);
            }
            else {
              load(context, config, callbacks);
            }
          };


        }

      }

      const playVideo = async () => {
        const setSize = () => {
          const widthRegex = /width=([0-9]{3,5})/g
          const heightRegex = /height=([0-9]{3,5})/g
          const heightResult = heightRegex.exec(location.search);
          if (heightResult?.length === 2) {
            const widthResult = widthRegex.exec(location.search);
            if (widthResult?.length === 2) {
              const size = getImageSize(parseInt(widthResult[1]), parseInt(heightResult[1]), 1280, 720);
              setWidth(size[0]);
              setHeight(size[1]);

            }
          }
        }

        if (videoRef?.current) {
          let source: string | null = null;
          let videoKey: string | null = null;
          let userData = userSession.loadUserData();
          let userName: string | undefined = undefined;
          if (owner && owner !== userData.username) {
            userName = owner;
          }
          if (access !== "public") {
            videoKey = await getEncryptedFile(userSession, `videos/${id}/key.bin`, id, VideosType, false, userName) as string;
            context.current.videoKey = videoKey;
          }
          setSize();

          source = await userSession.getFileUrl(`videos/${id}/master.m3u8`, {
            username: userName
          });

          if (source) {
            if (Hls.isSupported()) {
              hls = new Hls({
                loader: customLoader
              });

              hls.loadSource(source);
              hls.attachMedia(videoRef.current);
              hls.on(Hls.Events.MANIFEST_PARSED, function () {
                if (videoRef.current) {
                  let playPromise = videoRef.current.play();
                  if (playPromise !== undefined) {
                    playPromise.then((_: any) => {
                    })
                      .catch((error: any) => {
                      });
                  }
                }
              });
            }
            else {
              const w: any = window;
              const videoElem = videoRef.current;
              if (videoKey) {
                if (w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.gaideoMessageHandler) {
                  const buffer = Buffer.from(videoKey);
                  w.webkit.messageHandlers.gaideoMessageHandler.postMessage(
                    {
                      "type": "set-key",
                      "data": buffer.toString('base64'),
                      "url": source
                    }
                  )
                }
                videoElem.src = "gaideo://gaideo.com/master.m3u8";
              }
              else {
                videoElem.src = source;
              }
            }
          }
        }

      }

      playVideo();
    }
    return function cleanup() {
      if (hls) {
        hls.destroy();
        if (!Hls.isSupported()) {
          const w: any = window;
          if (w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.gaideoMessageHandler) {
            w.webkit.messageHandlers.gaideoMessageHandler.postMessage(
              {
                "type": "set-key",
                "data": null
              }
            )
          }
        }
      }
    }
  }, [userSession, location.search, id, owner, access]);


  return (
    <Fragment>
      {Hls.isSupported() &&
        <div style={{ paddingTop: !Hls.isSupported() ? 22 : 0, paddingLeft: props.isMobile ? 0 : 22 }}>
          <video
            ref={videoRef}
            id="video"
            width="100%"
            style={{ maxWidth: width, maxHeight: height }}
            controls></video>
          {showDescription &&
            <VideoDescription />
          }
        </div>
      }
      {!Hls.isSupported() &&
        <div style={{ paddingTop: 22, paddingLeft: props.isMobile ? 0 : 22 }}>
          <video
            playsInline
            muted
            autoPlay
            ref={videoRef}
            id="video"
            controls></video>
          {showDescription &&
            <VideoDescription />
          }
        </div>}
    </Fragment>
  );
}
