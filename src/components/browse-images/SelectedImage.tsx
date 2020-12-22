import { useConnect } from "@blockstack/connect";
import { Box, Toolbar, Typography } from "@material-ui/core";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import React, { useState, useEffect } from "react";
import { trackPromise } from "react-promise-tracker";
import { useHistory } from "react-router-dom";
import { BrowseEntry } from "../../models/browse-entry";
import { MediaMetaData } from "../../models/media-meta-data";
import { Photo } from '../../models/photo';
import { addToGroup, getShares, isFileShared, removeFromGroup, shareFile } from "../../utilities/gaia-utils";
import { deleteImageEntry } from "../../utilities/media-utils";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ConfirmDialog from "../confirm-dialog/ConfirmDialog";
import { getImageSize } from "../../utilities/image-utils";
import { UserSession } from "blockstack";
import { UpdateProgressCallback } from "../../models/callbacks";
import { ShareUserEntry } from "../../models/share-user-entry";
import ShareUserDialog from "../share-user-dialog/ShareUserDialog";
import AddToPlaylistDialog from "../playlists/AddToPlaylistDialog";
import AdjustIcon from '@material-ui/icons/Adjust';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import RemoveIcon from '@material-ui/icons/Remove';
import { SpeedDial, SpeedDialAction } from "@material-ui/lab";

interface CheckmarkProps {
  selected: boolean
}

const Checkmark = (props: CheckmarkProps) => {
  return (
    <div
      style={
        props.selected
          ? { left: "4px", top: "4px", position: "absolute", zIndex: 1 }
          : { display: "none" }
      }
    >
      <svg
        style={{ fill: "white", position: "absolute" }}
        width="24px"
        height="24px"
      >
        <circle cx="12.5" cy="12.2" r="8.292" />
      </svg>
      <svg
        style={{ fill: "#06befa", position: "absolute" }}
        width="24px"
        height="24px"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    </div>
  );
}
const imgStyle = {
  transition: "transform .135s cubic-bezier(0.0,0.0,0.2,1),opacity linear .15s"
};
const selectedImgStyle = {
  transform: "translateZ(0px) scale3d(0.9, 0.9, 1)",
  transition: "transform .135s cubic-bezier(0.0,0.0,0.2,1),opacity linear .15s"
};
const cont: CSSProperties = {
  backgroundColor: "#eee",
  cursor: "pointer",
  overflow: "hidden",
  position: "relative",
  left: "",
  top: ""
};

interface DeletePhotoCallback {
  (photo: Photo): void
}

interface SelectImageCallback {
  (photo: Photo): void
}

interface ToggleSelectionCallback {
  (): void
}

interface DeleteSelectedCallback {
  (): void
}

interface ShareSelectedCallback {
  (shareUsers: ShareUserEntry[], unshare: boolean): void
}

interface AddGroupSelectedCallback {
  (groupids: string[]): void
}

interface RemoveSelectedFromGroupCallback {
  (): void
}

export interface SelectedImageProps {
  index: number;
  photo: Photo;
  margin: string;
  direction: string;
  top: string;
  left: string;
  selected: boolean;
  selectable: boolean;
  totalCount: number;
  deleteCallback: DeletePhotoCallback;
  selectImageCallback: SelectImageCallback;
  toggleSelectionCallback: ToggleSelectionCallback;
  deleteSelectedCallback: DeleteSelectedCallback;
  shareSelectedCallback: ShareSelectedCallback;
  updateProgressCallback: UpdateProgressCallback;
  addGroupSelectedCallback: AddGroupSelectedCallback;
  removeSelectedFromGroupCallback: RemoveSelectedFromGroupCallback;
  worker: Worker | null,
  selectedPlaylist: string | null
}

const SelectedImage = (props: SelectedImageProps) => {
  const { authOptions } = useConnect();
  const { userSession } = authOptions;

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const history = useHistory();
  const [isSelected, setIsSelected] = useState(props.selected);
  const [shareUserOpen, setShareUserOpen] = React.useState(false);
  const [shareUsers, setShareUsers] = React.useState<Array<string>>([]);
  const [unshare, setUnshare] = React.useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const deleteImage = async (metaData: MediaMetaData, userSession: UserSession | undefined) => {
    if (userSession) {
      await deleteImageEntry(metaData, userSession, props.worker, props.updateProgressCallback);
    }
  }

  const deleteConfirmResult = (item: any, result: boolean) => {
    setConfirmOpen(false);
    if (result) {
      if (props.selectable) {
        props.deleteSelectedCallback();
      }
      else {
        let metaData: MediaMetaData = item as MediaMetaData;
        if (metaData) {
          trackPromise(deleteImage(metaData, userSession).then(x => {
            props.deleteCallback(props.photo);
          }))
        }
      }
    }
  }

  const shareUserResult = (item: MediaMetaData | null, unshare: boolean, result: ShareUserEntry[] | undefined) => {
    setShareUserOpen(false);
    if (userSession && result && result.length > 0) {
      if (props.selectable) {
        props.shareSelectedCallback(result, unshare);
      }
      else if (item) {
        trackPromise(shareFile([item], userSession, result, unshare));
      }
    }
  }

  const addToPlaylistResult = (item: MediaMetaData, result: string[] | undefined) => {
    setAddToPlaylistOpen(false);
    if (userSession && result && result.length > 0) {
      if (props.selectable) {
        props.addGroupSelectedCallback(result);
      }
      else {
        trackPromise(addToGroup([item], userSession, result));
      }
    }
  }

  const removePhotoFromGroup = async () => {
    if (props.photo.browseEntry
      && props.photo.browseEntry.metaData
      && userSession?.isUserSignedIn()
      && props.selectedPlaylist) {
      if (props.selectable) {
        props.removeSelectedFromGroupCallback();
      }
      else {
        await removeFromGroup([props.photo.browseEntry.metaData], userSession, props.selectedPlaylist)
        props.deleteCallback(props.photo);
      }
    }
  }

  const navImage = (browseEntry: BrowseEntry) => {
    history.push(`/images/show/${browseEntry.metaData.id}`)
  }

  const handleShare = async (isUnshare: boolean) => {
    if (userSession?.isUserSignedIn()) {
      let friends = await getShares(userSession);
      if (friends) {
        const users: string[] = []
        for (let key in friends) {
          let canAdd = true;
          if (!props.selectable && isUnshare) {
            const isShared = await isFileShared(userSession, key, props.photo.browseEntry.metaData.id, props.photo.browseEntry.metaData.type);
            if (!isShared) {
              canAdd = false;
            }
          }
          if (canAdd) {
            users.push(key);
          }
        }
        setUnshare(isUnshare)
        setShareUsers(users);
        setShareUserOpen(true);
      }
    }
  }

  const handleAction = async (action: any) => {
    if (action.name === 'Delete') {
      setConfirmOpen(true);
    }
    else if (action.name === 'Edit') {
      history.push(`/publish/${props.photo.browseEntry.metaData.type}/${props.photo.browseEntry.metaData.id}`);
    }
    else if (action.name.startsWith('Select')) {
      props.toggleSelectionCallback();
    }
    else if (action.name === 'Share' || action.name === 'Unshare') {
      trackPromise(handleShare(action.name === 'Unshare'));
    }
    else if (action.name === 'Add to playlist') {
      setAddToPlaylistOpen(true);
    }
    else if (action.name === 'Remove from playlist'
      && props.photo.browseEntry.metaData
      && userSession?.isUserSignedIn()
      && props.selectedPlaylist) {
      trackPromise(removePhotoFromGroup());
    }
    handleClose();
  };

  //calculate x,y scale
  const sx = (100 - (30 / props.photo.width) * 100) / 100;
  const sy = (100 - (30 / props.photo.height) * 100) / 100;
  selectedImgStyle.transform = `translateZ(0px) scale3d(${sx}, ${sy}, 1)`;

  if (props.direction === "column") {
    cont.position = "absolute";
    cont.left = props.left;
    cont.top = props.top;
  }

  const handleOnClick = () => {
    if (props.selectable) {
      setIsSelected(!isSelected);
    }
    props.selectImageCallback(props.photo);
  };

  function createPhoto(photo: Photo): any {
    if (props.totalCount === 1) {
      let size = getImageSize(photo.width, photo.height, 1024, 768);
      return {
        src: photo.src,
        title: photo.title,
        height: size[1],
        width: size[0]
      }
    }
    return {
      src: photo.src,
      title: photo.title,
      height: photo.height,
      width: photo.width
    }
  }

  useEffect(() => {
    setIsSelected(props.selected);
  }, [props.selected]);

  const photo = createPhoto(props.photo);

  const getConfirmMessage = (title: string | undefined) => {
    if (props.selectable) {
      return 'Are you sure you want to delete all selected images?'
    }
    return `Are you sure you want to delete ${title}?`
  }

  const handleClose = () => {
    setOpen(false);
  };

  const handleOpen = (event: any) => {
    if (event.type !== "focus") {
      setOpen(true);
    }
  };

  const getActions = () => {
    let actions: any[] = [];
    if (props.selectable) {
      actions.push({ icon: <AdjustIcon />, name: 'Select Off' })
    }
    else {
      actions.push({ icon: <AdjustIcon />, name: 'Select On' })
    }

    if (!props.photo.browseEntry.fromShare) {
      if (props.photo.browseEntry.metaData.isPublic) {
        actions.push({ icon: <EditIcon />, name: 'Edit' });
        actions.push({ icon: <DeleteIcon />, name: 'Delete' });
      }
      else {
        actions.push({ icon: <ScreenShareIcon />, name: 'Share' });
        actions.push({ icon: <StopScreenShareIcon />, name: 'Unshare' });
        actions.push({ icon: <EditIcon />, name: 'Edit' });
        actions.push({ icon: <DeleteIcon />, name: 'Delete' });
      }
    }

    if (props.selectedPlaylist) {
      actions.push({ icon: <RemoveIcon />, name: 'Remove from playlist' });
    }
    else {
      actions.push({ icon: <AddIcon />, name: 'Add to playlist' });
    }

    return actions;
  }

  return (
    <Box>
      <div
        style={{ margin: props.margin, height: photo.height, width: photo.width, ...cont }}
        className={!isSelected ? "not-selected" : ""}
      >
        <ConfirmDialog open={confirmOpen} item={props.photo.browseEntry.metaData} onResult={deleteConfirmResult} title="Confirm Delete" message={getConfirmMessage(props.photo.browseEntry.metaData?.title)} />
        <ShareUserDialog open={shareUserOpen} metaData={props.photo.browseEntry.metaData} initialUsers={shareUsers} unshare={unshare} shareUsersResult={shareUserResult} />
        <AddToPlaylistDialog open={addToPlaylistOpen} metaData={props.photo.browseEntry.metaData} result={addToPlaylistResult} />

        <Checkmark selected={isSelected ? true : false} />
        <img height={100} width={100}
          alt={props.photo.title}
          style={
            isSelected ? { ...imgStyle, ...selectedImgStyle } : { ...imgStyle }
          }
          {...createPhoto(photo)}
          onClick={handleOnClick}
        />
        <style>{`.not-selected:hover{outline:2px solid #06befa}`}</style>
      </div>
      <Toolbar style={{ paddingLeft: 5, justifyContent: 'space-between' }} disableGutters={true}>
        <div onClick={() => { navImage(props.photo.browseEntry) }} style={{maxWidth: 350}}>
          <Typography variant="caption">{`${props.photo.browseEntry.metaData?.title} (${props.photo.browseEntry.age})`}</Typography>
        </div>
        <div style={{ width: 40 }}>
        </div>
        <div style={{ position: 'relative', top: -15 }}>
          <SpeedDial
            ariaLabel="Menu Dial"
            style={{ left: -47, position: 'absolute' }}
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
      </Toolbar>
    </Box>
  );
};

export default SelectedImage;
