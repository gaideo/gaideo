import React, { Fragment, useEffect, useState } from 'react';
import SaveIcon from '@material-ui/icons/Save';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import AsyncSelect from 'react-select/async';
import makeAnimated from 'react-select/animated';
import { IconButton } from '@material-ui/core';
import { createHashAddress, getSavedSearches, updateSavedSearch } from '../../utilities/gaia-utils';
import { useConnect } from '@blockstack/connect';
import { SavedSearch } from '../../models/saved-search';
import { getNow } from '../../utilities/time-utils';
import { trackPromise } from 'react-promise-tracker';
import { SpeedDial, SpeedDialAction } from '@material-ui/lab';
import MoreVertIcon from '@material-ui/icons/MoreVert';


interface ShowCallback {
    (show: boolean): void
}

interface SetSearchTextCallback {
    (searchText: string): void
}

interface SearchProps {
    show: boolean;
    showCallback: ShowCallback;
    isMobile: boolean;
    setSearchTextCallback: SetSearchTextCallback;
}

export function Search(props: SearchProps) {

    const { authOptions } = useConnect();
    const { userSession } = authOptions;

    const [savedSearches, setSavedSearches] = useState(new Array<SavedSearch>());
    const [selectedSearch, setSelectedSearch] = useState<any>(null);
    const [changeKey, setChangeKey] = useState('');
    const [open, setOpen] = React.useState(false);

    useEffect(() => {
        const refresh = async () => {
            if (userSession?.isUserSignedIn()) {
                const results = await getSavedSearches(userSession);
                if (results) {
                    const arr: SavedSearch[] = [];
                    for (let key in results) {
                        arr.push(results[key]);
                    }
                    setSavedSearches(arr);
                }
            }
        }
        refresh();
    }, [userSession]);

    const handleSaveSearch = async () => {
        if (selectedSearch && userSession?.isUserSignedIn()) {
            await updateSavedSearch(userSession, {
                hashId: selectedSearch.value,
                searchText: selectedSearch.label,
                created: getNow()
            })
        }
    };

    const handleDeleteSearch = async () => {
        if (selectedSearch && userSession?.isUserSignedIn()) {
            await updateSavedSearch(userSession, {
                hashId: selectedSearch.value,
                searchText: selectedSearch.label,
                created: getNow()
            }, true)
            const hashId = selectedSearch.value;
            const arr = savedSearches.slice();
            let foundIndex = -1;
            for (let i = 0; i < savedSearches.length; i++) {
                if (savedSearches[i].hashId === hashId) {
                    foundIndex = i;
                    break;
                }
            }
            if (foundIndex >= 0) {
                arr.splice(foundIndex, 1);
            }
            updateSearchText(null);
            setSavedSearches(arr);
            setChangeKey(JSON.stringify(arr));
        }
    };

    const handleSearchHide = () => {
        updateSearchText(null);
        props.showCallback(false);
    };

    const handleInputChanged = (newValue: any) => {
        if (newValue && newValue.length > 0) {
            if (savedSearches.length === 0 || savedSearches[0].hashId) {
                const arr = savedSearches.slice();
                arr.splice(0, 0, {
                    hashId: '',
                    searchText: newValue,
                    created: getNow()
                })
                setSavedSearches(arr);
            }
            else {
                const arr = savedSearches.slice();
                arr.splice(0, 1);
                arr.splice(0, 0, {
                    hashId: '',
                    searchText: newValue,
                    created: getNow()
                })
                setSavedSearches(arr);
            }
        }
    }

    const handleChanged = (newValue: any) => {
        if (newValue) {
            let hashId;
            if (!newValue.value && newValue.label && newValue.label.trim().length > 2) {
                hashId = createHashAddress([newValue.label]);
                let foundExisting = false;
                for (let i = 0; i < savedSearches.length; i++) {
                    if (savedSearches[i].hashId === hashId) {
                        foundExisting = true;
                        break;
                    }
                }
                if (!foundExisting) {
                    const arr = savedSearches.slice();
                    arr.splice(0, 1);
                    arr.splice(0, 0, {
                        hashId: hashId,
                        searchText: newValue.label,
                        created: getNow()
                    });
                    setSavedSearches(arr);
                    setChangeKey(JSON.stringify(arr));
                    props.setSearchTextCallback(newValue.label);
                    newValue.value = hashId;
                }
            }
            else {
                hashId = newValue.value;
            }
            updateSearchText(newValue);
        }
        else {
            updateSearchText(null);
        }
    }

    const updateSearchText = (entry: any) => {
        setSelectedSearch(entry);
        if (entry && entry.label) {
            props.setSearchTextCallback(entry.label);
        }
        else {
            props.setSearchTextCallback('');
        }
    }

    const filter = async (inputValue: string) => {
        let filteredOptions: any[] = [];
        const copy = savedSearches.slice();
        copy.sort((x, y) => {
            if (!x && y) {
                return 1;
            }
            else if (x && !y) {
                return -1;
            }
            else if (x.created < y.created) {
                return 1;
            }
            else if (x.created > y.created) {
                return -1;
            }
            else {
                return 0;
            }
        })

        for (let i = 0; i < copy.length; i++) {
            let entry = copy[i];
            if (!inputValue || (inputValue.length > 0 && entry.searchText.toLowerCase().startsWith(inputValue.toLowerCase()))) {
                filteredOptions.push({
                    value: entry.hashId,
                    label: entry.searchText
                });
            }
        }
        return filteredOptions;
    }

    const promiseOptions = (inputValue: string) =>
        new Promise(resolve => {
            resolve(filter(inputValue));
        });

    const animatedComponents = makeAnimated();

    const handleClose = () => {
        setOpen(false);
    };

    const handleOpen = (event: any) => {
        if (event.type !== "focus") {
            setOpen(true);
        }
    };

    const handleAction = (action: any) => {
        handleClose();
        if (action.name === 'Save') {
            trackPromise(handleSaveSearch());
        }
        else if (action.name === 'Delete') {
            handleDeleteSearch();
        }
    }

    const getActions = () => {
        const actions = [
            { icon: <SaveIcon />, name: 'Save' }            
        ];
        if (selectedSearch) {
            actions.push({ icon: <DeleteIcon />, name: 'Delete' })
        }
        return actions;
    }

    return (
        <div style={{ paddingTop: props.show ? 30 : 0, paddingLeft: !props.isMobile ? 22 : 0 }}>
            {props.show &&
                <Fragment>
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <div style={{ flex: '1 1 auto' }}>
                            <AsyncSelect
                                autoFocus={true}
                                key={changeKey}
                                value={selectedSearch}
                                placeholder="Enter search keywords..."
                                cacheOptions
                                defaultOptions
                                loadOptions={promiseOptions}
                                components={animatedComponents}
                                onInputChange={(newValue, actionMeta) => handleInputChanged(newValue)}
                                onChange={(newValue, actionMeta) => { handleChanged(newValue) }} />
                        </div>
                        <div style={{width: 40}}>

                        </div>
                        <div style={{ position: 'relative' }}>
                            <SpeedDial
                                style={{left:-43, position: 'absolute'}}
                                ariaLabel="Friend Action Menu"
                                icon={<MoreVertIcon />}
                                onClose={handleClose}
                                onOpen={handleOpen}
                                open={open}
                                direction={"down"}>
                                {getActions().map((action) => (
                                    <SpeedDialAction
                                        key={action.name}
                                        icon={action.icon}
                                        tooltipTitle={action.name}
                                        onClick={() => handleAction(action)}
                                    />
                                ))}
                            </SpeedDial>
                        </div>
                        <div onClick={handleSearchHide} style={{ cursor: 'pointer', padding: 0 }}>
                            <IconButton style={{ minWidth: 30, outline: 'none', padding: 0 }}>
                                <CloseIcon />
                            </IconButton>
                        </div>
                    </div>
                </Fragment>
            }
        </div>
    );

}
