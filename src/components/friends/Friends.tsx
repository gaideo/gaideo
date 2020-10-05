import React, { Fragment, useCallback, useEffect, useState } from 'react';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import AsyncSelect from 'react-select/async';
import makeAnimated from 'react-select/animated';
import { Icon } from '@material-ui/core';
import AddFriendDialog from './AddFriendDialog';
import { getShares, getSelectedShares, updateShares } from '../../utilities/gaia-utils';
import { useConnect } from '@blockstack/connect';
import { trackPromise } from 'react-promise-tracker';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';


interface ShowCallback {
    (show: boolean): void
}

interface SaveSelectedFriendsCallback {
    (selected: Array<any> | undefined | null): void
}

interface FriendsProps {
    show: boolean;
    showCallback: ShowCallback;
    isMobile: boolean;
    saveSelectedFriendsCallback: SaveSelectedFriendsCallback;
}

export function Friends(props: FriendsProps) {

    const { authOptions } = useConnect();
    const { userSession } = authOptions;

    const [openAdd, setOpenAdd] = useState(false);
    const [confirmDeleteFriendOpen, setConfirmDeleteFriendOpen] = React.useState(false);
    const [friendList, setFriendList] = useState('');
    const [selectedFriends, setSelectedFriends] = useState<Array<any> | undefined | null>([]);

    useEffect(() => {
        const refresh = async () => {
            if (userSession?.isUserSignedIn()) {
                let arr = await getSelectedShares(userSession);
                if (arr && arr.length > 0) {
                    setSelectedFriends(arr.map(x => {
                        return {
                            label: x,
                            value: x
                        }
                    }));
                }
            }
        }
        refresh();
    }, [userSession]);
    const handleAddFriendOpen = () => {
        setOpenAdd(true);
    };

    const handleDeleteFriend = () => {
        if (selectedFriends && selectedFriends?.length > 0) {
            setConfirmDeleteFriendOpen(true);
        }
    };
    const handleFriendsHide = () => {
        props.showCallback(false);
    };

    const updateFriendListCallback = useCallback(async (friends: string[], deleteFlag: boolean) => {
        if (friends && friends.length > 0 && userSession?.isUserSignedIn()) {
            await updateShares(userSession, friends, deleteFlag);
            let updated = await getShares(userSession);
            if (updated) {
                let list: string[] = [];
                for (let key in updated) {
                    list.push(key);
                }
                setFriendList(list.join(","));
            }
            else {
                setFriendList('');
            }
        }

    }, [userSession])

    const setAddFriendDialogOpenCallback = useCallback((open: boolean, friend: string | null) => {
        setOpenAdd(open);
        if (!open
            && friend
            && friend?.length > 0
            && userSession?.isUserSignedIn()) {
            trackPromise(updateFriendListCallback([friend], false));
        }

    }, [userSession, updateFriendListCallback]);

    const filterFriends = async (inputValue: string) => {
        let friends: any = await getShares(userSession);
        let options: any[] = [];
        for (let key in friends) {
            if (!inputValue || (inputValue.length > 0 && key.startsWith(inputValue))) {
                options.push({
                    value: friends[key],
                    label: friends[key]
                });
            }
        }
        options.sort((x, y) => {
            if (!x && y) {
                return -1;
            }
            else if (x && !y) {
                return 1;
            }
            else if (x.label < y.label) {
                return -1;
            }
            else if (x.label > y.label) {
                return 1;
            }
            else {
                return 0;
            }
        })
        return options;
    }
    const promiseOptions = (inputValue: string) =>
        new Promise(resolve => {
            resolve(filterFriends(inputValue));
        });

    const animatedComponents = makeAnimated();

    const deleteConfirmResult = (item: any, result: boolean) => {
        setConfirmDeleteFriendOpen(false);
        if (result) {
            let values: any[] = item as any[];
            if (userSession?.isUserSignedIn() && values?.length > 0) {
                let userNames = values.map(x => x.value);
                setSelectedFriends(null);
                trackPromise(updateFriendListCallback(userNames, true));
            }
        }
    }

    return (
        <div style={{ paddingTop: props.show ? 30 : 0, paddingLeft: !props.isMobile ? 22 : 0 }}>
            {props.show &&
                <Fragment>
                    <ConfirmDialog open={confirmDeleteFriendOpen} item={selectedFriends} onResult={deleteConfirmResult} title="Confirm Delete" message={`Are you sure you want to delete the selected friends?`} />
                    <AddFriendDialog open={openAdd} setAddFriendDialogOpenCallback={setAddFriendDialogOpenCallback} />
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <div style={{ flex: '1 1 auto' }}>
                            <AsyncSelect
                                key={JSON.stringify(friendList)}
                                value={selectedFriends}
                                placeholder="Follow friends..."
                                closeMenuOnSelect={false}
                                cacheOptions
                                defaultOptions
                                loadOptions={promiseOptions}
                                components={animatedComponents}
                                isMulti
                                onChange={(newValue, actionMeta) => { setSelectedFriends(newValue); props.saveSelectedFriendsCallback(newValue); }} />
                        </div>
                        <div onClick={handleAddFriendOpen} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 3, paddingRight: 3 }}><Icon><AddIcon /></Icon></div>
                        <div onClick={handleDeleteFriend} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 3, paddingRight: 3 }}><Icon><DeleteIcon /></Icon></div>
                        <div onClick={handleFriendsHide} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 3, paddingRight: 3 }}><Icon><CloseIcon /></Icon></div>
                    </div>
                </Fragment>
            }
        </div>
    );

}
