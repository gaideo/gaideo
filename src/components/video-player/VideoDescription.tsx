import React, { useState, useEffect } from 'react';
import { useConnect } from "@blockstack/connect";
import { useParams } from "react-router-dom";
import { BrowseEntry } from "../../models/browse-entry";
import { loadBrowseEntry } from "../../utilities/data-utils";
import { Typography } from '@material-ui/core';
import { getNow, getLongDate } from '../../utilities/time-utils';
import { MediaType } from '../../models/media-entry';

interface ParamTypes {   id: string; } 

export function VideoDescription() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const {id} = useParams<ParamTypes>();
    const [browseEntry, setBrowseEntry] = useState<BrowseEntry | null>(null);

    useEffect(() => {
        const getDescription = async () => {
            let indexFile: string = `videos/${id}.index`;
            if (userSession) {
                let be = await loadBrowseEntry(userSession, indexFile, false, MediaType.Video);
                if (be) {
                    setBrowseEntry(be);
                }
            }
        }
        getDescription();
    }, [userSession, id]);

    return (
        <div style={{paddingLeft: 24}}>
            <div>
                <Typography variant="h5">{browseEntry?.mediaEntry?.title}</Typography>
            </div>
            <div>
                <Typography variant="subtitle1">{`${getLongDate(new Date(browseEntry?.mediaEntry.createdDateUTC ? browseEntry.mediaEntry.createdDateUTC : getNow()))}`}</Typography>
            </div>
            <div>
                <Typography variant="subtitle2">{browseEntry?.mediaEntry?.description}</Typography>
            </div>
        </div>

    );
}