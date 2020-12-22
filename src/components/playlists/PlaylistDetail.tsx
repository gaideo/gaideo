import React from 'react';
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Avatar from '@material-ui/core/Avatar';
import MusicIcon from '@material-ui/icons/MusicNoteOutlined';
import MovieIcon from '@material-ui/icons/MovieOutlined';
import PlayIcon from '@material-ui/icons/PlayCircleOutline';
import PauseIcon from '@material-ui/icons/PauseOutlined'
import CameraIcon from '@material-ui/icons/CameraEnhanceOutlined';
import ArrowUpIcon from '@material-ui/icons/ArrowUpwardOutlined';
import ArrowDownIcon from '@material-ui/icons/ArrowDownwardOutlined';

import DeleteIcon from '@material-ui/icons/Delete';
import { EditPlaylistEntry } from '../../models/edit-playlist-entry';
import { IconButton, Typography } from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    demo: {
      backgroundColor: theme.palette.background.paper,
    },
    title: {
      margin: theme.spacing(4, 0, 2),
    },
  }),
);

interface SetPlaylistEntriesCallback {
  (entries: Array<EditPlaylistEntry>): void
}

interface SetPlayEntryCallback {
  (index: number): void
}

interface SetPlayingCallback {
  (flag: boolean): void
}

interface PlaylistDetailProps {
  playlistId: string | null | undefined;
  playlistEntries: Array<EditPlaylistEntry>;
  setPlaylistEntriesCallback: SetPlaylistEntriesCallback;
  selectedIndex?: number;
  disableEdit?: boolean;
  setPlayEntryCallback?: SetPlayEntryCallback;
  playingIndex?: number;
  setPlayingCallback? : SetPlayingCallback
}

export default function PlaylistDetail(props: PlaylistDetailProps) {
  const classes = useStyles();

  function array_move(arr: Array<any>, old_index: number, new_index: number) {
    if (new_index >= arr.length) {
      var k = new_index - arr.length + 1;
      while (k--) {
        arr.push(undefined);
      }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr; // for testing
  };

  const handleMoveItemDown = (index: number) => {
    if (index === (props.playlistEntries.length - 1)) {
      let newArr = array_move(props.playlistEntries, props.playlistEntries.length - 1, 0).slice();
      props.setPlaylistEntriesCallback(newArr);
    }
    else {
      let newArr = array_move(props.playlistEntries, index, index + 1).slice();
      props.setPlaylistEntriesCallback(newArr);
    }
  };

  const handleMoveItemUp = (index: number) => {
    if (index === 0) {
      let newArr = array_move(props.playlistEntries, 0, props.playlistEntries.length - 1).slice();
      props.setPlaylistEntriesCallback(newArr);
    }
    else {
      let newArr = array_move(props.playlistEntries, index, index - 1).slice();
      props.setPlaylistEntriesCallback(newArr);
    }
  };

  const handleDeleteItem = (index: number) => {
    let newArr = props.playlistEntries.slice();
    newArr.splice(index, 1);
    props.setPlaylistEntriesCallback(newArr);
  };

  const handlePlayItem = (index: number) => {
    if (props.setPlayEntryCallback) {
      if (index === props.selectedIndex && props.setPlayingCallback) {
        if (props.playingIndex === index) {
          props.setPlayingCallback(false);          
        }
        else {
          props.setPlayingCallback(true);          
        }
      }
      else {
        props.setPlayEntryCallback(index);
      }
    }
  }
  
  return (
    <div className={classes.root} style={{ margin: 0 }}>
      <List dense={true}>
        {props.playlistEntries.map((x, index) => (
          <ListItem disableGutters key={x.indexFile} style={{ minWidth: 285, backgroundColor: props.selectedIndex === index ? 'rgba(0, 0, 0, 0.08)' : 'inherit' }}>
            <div style={{ display: 'flex', flex: '1 1 auto', alignContent: 'center', justifyContent: 'space-between', flexDirection: 'row' }}>
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                <div>
                  <Avatar>
                    {x.type === 'music' ? (<MusicIcon />) : x.type === 'image' ? (<CameraIcon />) : (<MovieIcon />)}
                  </Avatar>
                </div>
                <div style={{ paddingLeft: 6, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption">{x.title}</Typography>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', flexDirection: 'row', wordWrap: "break-word" }}>
                  {props.setPlayEntryCallback &&
                    <div onClick={() => handlePlayItem(index)} style={{ cursor: 'pointer', paddingTop: 3, paddingLeft: 0, paddingRight: 0 }}>
                      <IconButton style={{ minWidth: 30, outline: 'none', padding: 0 }}>
                        {props.playingIndex === index ? (
                          <PauseIcon />
                        ) : (
                          <PlayIcon />
                          )}
                      </IconButton>
                    </div>
                  }
                  {!props.disableEdit &&
                    <div onClick={() => handleDeleteItem(index)} style={{ cursor: 'pointer', paddingTop: 3, paddingLeft: 0, paddingRight: 0 }}>
                      <IconButton style={{ minWidth: 30, outline: 'none', padding: 0 }}>
                        <DeleteIcon />
                      </IconButton>
                    </div>
                  }
                  {!props.disableEdit &&
                    <div onClick={() => handleMoveItemDown(index)} style={{ cursor: 'pointer', paddingTop: 3, paddingLeft: 0, paddingRight: 0 }}>
                      <IconButton style={{ minWidth: 30, outline: 'none', padding: 0 }}>
                        <ArrowDownIcon />
                      </IconButton>
                    </div>
                  }
                  {!props.disableEdit &&
                    <div onClick={() => handleMoveItemUp(index)} style={{ cursor: 'pointer', paddingTop: 3, paddingLeft: 0, paddingRight: 0 }}>
                      <IconButton style={{ minWidth: 30, outline: 'none', padding: 0 }}>
                        <ArrowUpIcon />
                      </IconButton>
                    </div>
                  }
                </div>
              </div>
            </div>
          </ListItem>
        ))}
      </List>
    </div>
  );
}
