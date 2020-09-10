import React, { useEffect } from 'react';
import { useConnect } from '@blockstack/connect';
import { Toolbar } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import "./BrowseVideos.css";
import VideoActions from '../video-actions/VideoActions';
import { useHistory } from 'react-router-dom';
import { loadBrowseEntry } from '../../utilities/data-utils';

export function BrowseVideos() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [browseEntries, setBrowseEntries] = React.useState(new Array<BrowseEntry>());
    const history = useHistory();

    useEffect(() => {

        const refresh = async () => {
            const indexes: string[] = [];
            let arr: BrowseEntry[] = [];
            userSession?.listFiles((name: string) => {
                if (name.startsWith("videos/")
                    && name.endsWith(".index")) {
                    indexes.push(name);
                    loadBrowseEntry(userSession, name, true).then((x: any) => {
                        let be = x as BrowseEntry;
                        if (be) {
                            arr.push(be)
                            setBrowseEntries(arr.slice());
                        }
                    })
                    if (indexes.length >= 20) {
                        return false;
                    }
                }
                return true;
            })
        }
        refresh();
    }, [userSession, history]);

    const navVideo = (browseEntry: BrowseEntry) => {
        history.push(`/videos/show/${browseEntry.videoEntry.id}`)
    }

    return (        
        <Toolbar style={{ flexWrap: 'wrap' }}>
            {browseEntries.map(x => (
                <div key={x.videoEntry.id}>
                    <div style={{ width: 331, height: 200, cursor: 'pointer' }} onClick={() => { navVideo(x); }}>
                        <img id={x.videoEntry.id} alt={x.videoEntry.title} src={`data:image/png;base64, ${x.previewImage}`} />
                    </div>
                    <Toolbar style={{ justifyContent: 'space-between' }}>
                        <div onClick={() => { navVideo(x) }}>
                            {x.videoEntry.title}
                        </div>
                        <div>
                            <VideoActions videoEntry={x.videoEntry} />
                        </div>
                    </Toolbar>
                </div>
            ))}
        </Toolbar>

    );
}
