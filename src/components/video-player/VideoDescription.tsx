import React, { useState, useEffect } from 'react';
import { useConnect } from "@blockstack/connect";
import { useParams } from "react-router-dom";
import { BrowseEntry } from "../../models/browse-entry";
import { loadBrowseEntry } from "../../utilities/data-utils";
import { Typography } from '@material-ui/core';
import { getNow, getLongDate } from '../../utilities/time-utils';

interface ParamTypes { id: string; owner?: string }

export function VideoDescription() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const { id, owner } = useParams<ParamTypes>();
    const [browseEntry, setBrowseEntry] = useState<BrowseEntry | null>(null);

    useEffect(() => {
        const getDescription = async () => {
            if (userSession?.isUserSignedIn()) {
                let userData = userSession.loadUserData();
                let userName: string | undefined = undefined;
                if (owner && owner !== userData.username) {
                    userName = owner;
                }

                let indexFile: string = `videos/${id}.index`;
                let be = await loadBrowseEntry(userSession, indexFile, false, userName);
                if (be) {
                    setBrowseEntry(be);
                }
        }
        }
        getDescription();
    }, [userSession, id, owner]);

    return (
        <div style={{ paddingLeft: 5 }}>
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