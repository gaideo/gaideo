import React, { useState, useEffect } from 'react';
import { useConnect } from "@blockstack/connect";
import { useParams } from "react-router-dom";
import { BrowseEntry } from "../../models/browse-entry";
import { loadBrowseEntry } from "../../utilities/data-utils";
import { Typography } from '@material-ui/core';

export function VideoDescription() {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const { id } = useParams();
    const [browseEntry, setBrowseEntry] = useState<BrowseEntry | null>(null);

    useEffect(() => {
        const getDescription = async () => {
            let indexFile: string = `videos/${id}.index`;
            if (userSession) {
                let be = await loadBrowseEntry(userSession, indexFile, false);
                if (be) {
                    setBrowseEntry(be);
                }
            }
        }
        getDescription();
    }, [userSession, id]);

    return (
        <div>
            <div>
                <Typography variant="h5">{browseEntry?.videoEntry?.title}</Typography>
            </div>
            <div>
                <Typography variant="subtitle1">{browseEntry?.videoEntry?.description}</Typography>
            </div>
        </div>

    );
}