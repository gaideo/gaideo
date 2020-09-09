import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Box from '@material-ui/core/Box';
import PublishVideo from '../publish-video/PublishVideo';
import { BrowseVideos } from '../browse-videos/BrowseVideos';
import { useHistory, useParams, Switch, Route } from 'react-router-dom';
import { VideoPlayer } from '../video-player/VideoPlayer';

interface TabPanelProps {
  children?: React.ReactNode;
  index: any;
  value: any;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box style={{ display: 'flex', width: '100%' }} p={3}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: any) {
  return {
    id: `vertical-tab-${index}`,
    'aria-controls': `vertical-tabpanel-${index}`,
  };
}

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    width: '100%',
    height: 800,
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  input: { display: 'none' },
  button: {}
}));

export default function VerticalTabs() {
  const classes = useStyles();
  const history = useHistory();
  const { section } = useParams();

  const tabIndex = section === '1' ? 1 : 0;

  const handleChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    if (history.length > 0 && history.location.pathname === `/${newValue}`) {
      return;
    }
    history.push(`/${newValue}`);
  };

  return (
    <div className={classes.root}>
      <Tabs
        style={{ minWidth: 150 }}
        orientation="vertical"
        variant="scrollable"
        value={tabIndex}
        onChange={handleChange}
        aria-label="Vertical tabs example"
        className={classes.tabs}
      >
        <Tab label="Videos" {...a11yProps(0)}></Tab>
        <Tab label="Publish" {...a11yProps(1)} />
      </Tabs>
      <TabPanel value={tabIndex} index={0}>
        <Switch>
          <Route path="/:section/videos/:id">
            <VideoPlayer />
          </Route>
          <Route path="/:section">
            <BrowseVideos />
          </Route>
        </Switch>

      </TabPanel>
      <TabPanel value={tabIndex} index={1}>
        <PublishVideo />
      </TabPanel>
    </div>
  );
}
