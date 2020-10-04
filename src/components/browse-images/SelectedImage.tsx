import { useConnect } from "@blockstack/connect";
import { Box, IconButton, Menu, Toolbar, Typography } from "@material-ui/core";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import React, { useState, useEffect } from "react";
import { trackPromise } from "react-promise-tracker";
import { useHistory } from "react-router-dom";
import { BrowseEntry } from "../../models/browse-entry";
import { MediaMetaData } from "../../models/media-meta-data";
import { Photo } from '../../models/photo';
import { getShares, shareFile } from "../../utilities/gaia-utils";
import { deleteImageEntry } from "../../utilities/media-utils";
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ConfirmDialog from "../confirm-dialog/ConfirmDialog";
import { getImageSize } from "../../utilities/image-utils";
import { UserSession } from "blockstack";
import { UpdateProgressCallback } from "../../models/callbacks";
import { ShareUserEntry } from "../../models/share-user-entry";
import ShareUserDialog from "../share-user-dialog/ShareUserDialog";

interface CheckmarkProps {
  selected: boolean
}

const options = [
  'Share',
  'Edit',
  'Delete',
  'Select'
];

const ITEM_HEIGHT = 48;

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
  (shareUsers: ShareUserEntry[]): void
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
  worker: Worker | null
}

const SelectedImage = (props: SelectedImageProps) => {
  const { authOptions } = useConnect();
  const { userSession } = authOptions;

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [menuMetaData, setMenuMetaData] = React.useState<MediaMetaData | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const history = useHistory();
  const [isSelected, setIsSelected] = useState(props.selected);
  const [shareUserOpen, setShareUserOpen] = React.useState(false);
  const [shareUsers, setShareUsers] = React.useState<Array<string>>([]);

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

  const shareUserResult = (item: MediaMetaData, result: ShareUserEntry[] | undefined) => {
    setShareUserOpen(false);
    if (userSession && result && result.length > 0) {
      if (props.selectable) {
        props.shareSelectedCallback(result);
      }
      else {
        trackPromise(shareFile([item], userSession, result));
      }
    }
  }

  const navImage = (browseEntry: BrowseEntry) => {
    history.push(`/images/show/${browseEntry.metaData.id}`)
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>, metaData: MediaMetaData) => {
    setMenuMetaData(metaData);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  }

  const handleMenu = async (option: string) => {
    if (option === 'Delete') {
      if (menuMetaData) {
        setConfirmOpen(true);
      }
    }
    else if (option === 'Edit') {
      if (menuMetaData) {
        history.push(`/publish/${menuMetaData.type}/${menuMetaData.id}`);
      }
    }
    else if (option.startsWith('Select')) {
      props.toggleSelectionCallback();
    }
    else if (option === 'Share') {
      if (userSession?.isUserSignedIn()) {
        let friends = await getShares(userSession);
        if (friends) {
          const users: string[] = []
          for (let key in friends) {
            users.push(key);
          }
          setShareUsers(users);
          setShareUserOpen(true);
        }
      }
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

  const getMenuOption = (option: string) => {
    if (option.startsWith("Select")) {
      if (props.selectable) {
        return "Select Off";
      }
      else {
        return "Select On";
      }
    }
    return option
  }

  const photo = createPhoto(props.photo);

  const getConfirmMessage = (title: string | undefined) => {
    if (props.selectable) {
      return 'Are you sure you want to delete all selected images?'
    }
    return `Are you sure you want to delete ${title}?`
  }

  return (
    <Box>
      <div
        style={{ margin: props.margin, height: photo.height, width: photo.width, ...cont }}
        className={!isSelected ? "not-selected" : ""}
      >
        <ConfirmDialog open={confirmOpen} item={menuMetaData} onResult={deleteConfirmResult} title="Confirm Delete" message={getConfirmMessage(menuMetaData?.title)} />
        <ShareUserDialog open={shareUserOpen} metaData={menuMetaData} initialUsers={shareUsers} shareUsersResult={shareUserResult} />

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
        <div onClick={() => { navImage(props.photo.browseEntry) }}>
          <Typography variant="caption">{`${props.photo.browseEntry.metaData?.title} (${props.photo.browseEntry.age})`}</Typography>
        </div>
        {!props.photo.browseEntry.fromShare &&
        <div>
        <IconButton
          style={{ minWidth: 30, outline: 'none', paddingTop: 0, paddingBottom: 0, paddingLeft: 5, paddingRight: 5 }}
          onClick={(e) => handleClick(e, props.photo.browseEntry.metaData)}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          id="image-actions"
          anchorEl={anchorEl}
          keepMounted
          open={open}
          onClose={handleClose}
          PaperProps={{
            style: {
              maxHeight: ITEM_HEIGHT * 4.5,
              width: '20ch',
            },
          }}
        >
          {options.map((option) => (
            <MenuItem key={option} onClick={() => handleMenu(option)}>
              {getMenuOption(option)}
            </MenuItem>
          ))}
        </Menu>
      </div>
      }
      </Toolbar>
    </Box>
  );
};

export default SelectedImage;
