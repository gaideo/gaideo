import React, { useEffect } from 'react';
import { useConnect } from '@blockstack/connect';
import { Grid } from '@material-ui/core';
import { BrowseEntry } from '../../models/browse-entry';
import "./BrowseVideos.css";
import VideoActions from '../video-actions/VideoActions';
import { useParams, useHistory } from 'react-router-dom';
import { loadBrowseEntry } from '../../utilities/data-utils';

export function BrowseVideos() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [browseEntries, setBrowseEntries] = React.useState(new Array<BrowseEntry>());
    const { section, id } = useParams();
    const history = useHistory();


    useEffect(() => {

        const refresh = async () => {
            if (!id) {
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
        }
        refresh();
    }, [userSession, history, id]);

    const navVideo = (browseEntry: BrowseEntry) => {
        history.push(`/${section}/videos/${browseEntry.videoEntry.id}`)
    }

    return (
        <Grid container spacing={2} direction="row" justify="flex-start" alignItems="flex-start">
            {browseEntries.map(x => (
                <Grid key={x.videoEntry.id} item xs style={{ width: 331, height: 200, cursor: 'pointer' }}>
                    <div className="video-preview" style={{ width: '100%', height: '100%' }} onClick={() => { navVideo(x); }}>
                        <img id={x.videoEntry.id} style={{ maxWidth: '100%', height: '100%' }} alt={x.videoEntry.title} src={`data:image/png;base64, ${x.previewImage}`} />
                    </div>
                    <Grid container spacing={0} direction="row" justify="space-evenly">
                        <Grid item xs={10} style={{ verticalAlign: 'middle', marginTop: 3 }}>
                            <span onClick={() => {navVideo(x)}}>
                                {x.videoEntry.title}
                            </span>
                        </Grid>
                        <Grid item xs={1}>
                            <VideoActions videoEntry={x.videoEntry} />
                        </Grid>
                    </Grid>
                </Grid>)
            )}
        </Grid>
    );
}
