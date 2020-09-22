import React, { Fragment, useCallback, useState } from 'react';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import AsyncSelect from 'react-select/async';
import makeAnimated from 'react-select/animated';
import { Icon } from '@material-ui/core';
import AddFriendDialog from '../add-friend-dialog/AddFriendDialog';
import { getFriends, updateFriends } from '../../utilities/data-utils';
import { useConnect } from '@blockstack/connect';
import { trackPromise } from 'react-promise-tracker';
import ConfirmDialog from '../confirm-dialog/ConfirmDialog';


interface ShowCallback {
    (show: boolean) : void
}

interface FriendsProps {
    show: boolean;
    showCallback : ShowCallback;
    isMobile: boolean
}

export function Friends(props: FriendsProps) {

    const { authOptions } = useConnect();
    const { userSession } = authOptions;

    const [openAdd, setOpenAdd] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState<Array<any> | null | undefined>([]);
    const [confirmDeleteFriendOpen, setConfirmDeleteFriendOpen] = React.useState(false);
    const [friendList, setFriendList] = useState('');

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
            await updateFriends(userSession, friends, deleteFlag);
            let updated = await getFriends(userSession);
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
        console.log('getting friends');
        let friends: any = await getFriends(userSession);
        let options: any[] = [];
        for (let key in friends) {
            if (!inputValue || (inputValue.length > 0 && key.startsWith(inputValue))) {
                options.push({
                    value: friends[key],
                    label: friends[key]
                });
            }
        }
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
        <div style={{ paddingTop: 30, paddingLeft: !props.isMobile ? 22 : 0 }}>
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
                                onChange={(newValue, actionMeta) => { setSelectedFriends(newValue); console.log(newValue); console.log(actionMeta); }} />
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
