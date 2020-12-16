import React, { useState, useEffect } from 'react';
import { useConnect } from "@blockstack/connect";
import { useParams } from "react-router-dom";
import { BrowseEntry } from "../../models/browse-entry";
import { loadBrowseEntry } from "../../utilities/media-utils";
import { FormControlLabel, Switch, Typography } from '@material-ui/core';
import { getNow, getLongDate } from '../../utilities/time-utils';

interface ParamTypes { id: string; owner?: string; access?: string; type: string }

interface SetAutoPlayCallback {
    (autoPlay: boolean): void
}

interface VideoDescriptionProps {
    autoPlay: boolean,
    setAutoPlayCallback: SetAutoPlayCallback,
    playlistId: string
}

export function VideoDescription(props: VideoDescriptionProps) {
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const { id, owner, type } = useParams<ParamTypes>();
    const [browseEntry, setBrowseEntry] = useState<BrowseEntry | null>(null);

    useEffect(() => {
        const getDescription = async () => {
            if (id && type && userSession?.isUserSignedIn()) {
                let userData = userSession.loadUserData();
                let userName: string | undefined = undefined;
                if (owner && owner !== userData.username) {
                    userName = owner;
                }

                let indexFile: string = `${type}/${id}.index`;
                let be = await loadBrowseEntry(userSession, indexFile, false, userName);
                if (be) {
                    setBrowseEntry(be);
                }
            }
        }
        getDescription();
    }, [userSession, id, owner, type]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        props.setAutoPlayCallback(!props.autoPlay);
    };

    return (
        <div style={{ paddingLeft: 5 }}>
            <div>
                <Typography variant="h5">{browseEntry?.metaData?.title}</Typography>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                    <Typography variant="subtitle1">{`${getLongDate(new Date(browseEntry?.metaData.createdDateUTC ? browseEntry.metaData.createdDateUTC : getNow()))}`}</Typography>
                </div>
                {props.playlistId &&
                    <div>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={props.autoPlay}
                                    onChange={handleChange}
                                    name="checkedB"
                                    color="primary"
                                />
                            }
                            label="Auto Play"
                        />
                    </div>
                }
            </div>
            <div>
                <Typography variant="subtitle2">{browseEntry?.metaData?.description}</Typography>
            </div>
        </div>

    );
}