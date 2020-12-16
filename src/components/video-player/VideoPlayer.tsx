import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useConnect } from '@blockstack/connect';
import Hls from "hls.js";
import "../browse-videos/BrowseVideos.css";
import { useParams, useLocation, useHistory } from 'react-router-dom';
import { VideoDescription } from './VideoDescription';
import { getEncryptedFile } from '../../utilities/gaia-utils';
import { getImageSize } from '../../utilities/image-utils';
import { IDBPDatabase } from 'idb';
import { getPlaylistEntries, loadBrowseEntry } from '../../utilities/media-utils';
import { EditPlaylistEntry } from '../../models/edit-playlist-entry';
import PlaylistDetail from '../playlists/PlaylistDetail';

interface VideoPlayerContext {
  current: any;
}

interface ParamTypes {
  id: string;
  owner?: string;
  access?: string;
  type: string;
}

interface VideoPlayerProps {
  isMobile: boolean,
  db?: IDBPDatabase<unknown> | null | undefined;
}

export function VideoPlayer(props: VideoPlayerProps) {
  const { authOptions } = useConnect();
  const { userSession } = authOptions;
  const { access, type, id, owner } = useParams<ParamTypes>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const location = useLocation();
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [showDescription, setShowDescription] = useState(false);
  const [playlistId, setPlaylistId] = useState('');
  const [playlistEntries, setPlaylistEntries] = useState<Array<EditPlaylistEntry>>([]);
  const [playlistIndex, setPlaylistIndex] = useState(-1);
  const [autoPlay, setAutoPlay] = useState(true);

  const history = useHistory();

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
          source = `https://${owner}${path}${type}/${id}`;
          if (!source.endsWith("/")) {
            source += '/';
          }
          source = `${source}master.m3u8`;
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
  }, [access, owner, location.search, id, type])

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
          const playlistRegex = /playlist=([a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12})/g
          const playlistResult = playlistRegex.exec(location.search);
          if (playlistResult?.length === 2) {
            setPlaylistId(playlistResult[1]);
            if (props.db) {
              let indexFile = `${type}/${id}.index`;
              const entries = await getPlaylistEntries(userSession, props.db, playlistResult[1], type);
              for (let i = 0; i < entries.length; i++) {
                if (entries[i].indexFile === indexFile) {
                  setPlaylistIndex(i);
                }
              }
              setPlaylistEntries(entries);
            }
          }
          let source: string | null = null;
          let videoKey: string | null = null;
          let userData = userSession.loadUserData();
          let userName: string | undefined = undefined;
          if (owner && owner !== userData.username) {
            userName = owner;
          }
          if (access !== "public") {
            videoKey = await getEncryptedFile(userSession, `${type}/${id}/key.bin`, id, type, false, userName) as string;
            context.current.videoKey = videoKey;
          }
          setSize();

          source = await userSession.getFileUrl(`${type}/${id}/master.m3u8`, {
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

      if (props.db && userSession?.isUserSignedIn()) {
        playVideo();
      }
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
  }, [userSession, location.search, id, owner, access, type, props.db]);

  const playNext = async () => {
    if (autoPlay && playlistId && userSession?.isUserSignedIn()) {
      let index = 0;
      if (playlistIndex >= 0) {
        index = playlistIndex + 1;
      }
      if (index >= playlistEntries.length) {
        index = 0;
      }
      setPlayEntryCallback(index);
    }
  }

  const setPlaylistEntriesCallback = useCallback((newPlaylistEntries: EditPlaylistEntry[]) => {
    setPlaylistEntries(newPlaylistEntries);
  }, []);

  const setPlayEntryCallback = useCallback(async (index: number) => {
    let entry = playlistEntries[index];
    let currentIndexFile = `${type}/${id}.index`;
    if (userSession && currentIndexFile !== entry.indexFile) {
      let ud = userSession.loadUserData();
      let userName: string | undefined = entry.userName;
      if (userName === ud.username) {
        userName = undefined;
      }
      let browseEntry = await loadBrowseEntry(userSession, entry.indexFile, false, userName);
      if (browseEntry) {
        let user = '';

        if (browseEntry.metaData.userName) {
          user = `/${browseEntry.metaData.userName}`;
        }
        setPlaylistIndex(index);
        const access = browseEntry.metaData.isPublic ? "public" : "private";
        let url = `/videos/show/${access}/${browseEntry.metaData.type}/${browseEntry.metaData.id}${user}?height=${browseEntry.actualHeight}&width=${browseEntry.actualWidth}&playlist=${playlistId}`;
        history.push(url);

      }
    }
  }, [userSession, history, id, playlistEntries, playlistId, type]);

  const setAutoPlayCallback = useCallback((value: boolean) => {
    setAutoPlay(value);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: props.isMobile ? 'column' : 'row' }}>
      {Hls.isSupported() &&
        <div style={{ flex: '1 1 auto', paddingTop: !Hls.isSupported() ? 22 : 0, paddingLeft: props.isMobile ? 0 : 22 }}>
          <video
            ref={videoRef}
            id="video"
            width="100%"
            style={{ border: 'none', maxWidth: width, maxHeight: height }}
            controls
            onEnded={() => playNext()}></video>
          {showDescription &&
            <div style={{ maxWidth: width, maxHeight: height }}>
              <VideoDescription
                playlistId={playlistId}
                autoPlay={autoPlay}
                setAutoPlayCallback={setAutoPlayCallback}
              />
            </div>
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
            controls
            onEnded={() => playNext()}></video>
          {showDescription &&
            <div style={{ maxWidth: width, maxHeight: height }}>
              <VideoDescription playlistId={playlistId} autoPlay={autoPlay} setAutoPlayCallback={setAutoPlayCallback} />
            </div>
          }
        </div>}
      {playlistId &&
        <div style={{ paddingTop: props.isMobile ? 0 : 22 }}>
          <div style={{ height: '100%', marginTop: props.isMobile ? 0 : 10, marginLeft: 10, paddingLeft: 10, paddingRight: 10, marginRight: 10, maxWidth: 350, borderStyle: 'solid', borderWidth: 1, borderColor: 'darkgrey' }}>
            <PlaylistDetail
              selectedIndex={playlistIndex}
              playlistId={playlistId}
              playlistEntries={playlistEntries}
              setPlaylistEntriesCallback={setPlaylistEntriesCallback}
              setPlayEntryCallback={setPlayEntryCallback}
              disableEdit={true}
            ></PlaylistDetail>
          </div>
        </div>
      }
    </div>
  );
}
