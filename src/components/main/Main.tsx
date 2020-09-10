import React, { useState, useEffect } from 'react';
import { makeStyles, Divider, List, ListItem, ListItemText, AppBar, Toolbar, Drawer, Typography, Hidden, IconButton, Button, Menu, MenuItem } from "@material-ui/core";
import MenuIcon from '@material-ui/icons/Menu';
import { useConnect } from '@blockstack/connect';
import { UserData } from 'blockstack/lib/auth/authApp';
import AccountCircle from '@material-ui/icons/AccountCircle';
import { useHistory } from 'react-router-dom';
import { ContentPane } from '../../content-pane/ContentPane';

const drawerWidth = 240;
const useStyles = makeStyles((theme) => ({
    drawer: {
        maxWidth: drawerWidth,
        width: drawerWidth,
        flexShrink: 0,
    },
    toolbar: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        padding: theme.spacing(3),
        [theme.breakpoints.up('sm')]: {
            marginLeft: 250,
        },
    },
    title: {
        flexGrow: 1,
        verticalAlign: 'middle'
    },
    button: {
        outline: 'none',
        verticalAlign: 'middle'
    }
}));

export default function Main() {

    const classes = useStyles();
    const [state, setSmallDevice] = React.useState(false);
    const handleSmallDevice = () => {
        setSmallDevice(!state);
    };
    const { doOpenAuth }: any = useConnect();
    const { authOptions } = useConnect();
    const { userSession } = authOptions;
    const [userData, setUserData] = useState<UserData | null>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [selectedNavItem, setSelectedNavItem] = useState('Videos');
    const open = Boolean(anchorEl);
    const history = useHistory();

    useEffect(() => {

        const refresh = async () => {
            if (userSession?.isSignInPending()) {
                await userSession.handlePendingSignIn();
            }

        }
        refresh();
    }, [userSession, userData]);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }

    const handleMenu = (option: string) => {
        if (option === 'logout') {
            userSession?.signUserOut();
            window.location.href = '/';
        }
        handleClose();
    };

    const navigateContent = (name: string) => {
        let path: string = '/videos/browse';
        if (name === "Publish") {
            path = '/publish';
        }
        else if (name === "Encrypt Videos") {
            path = '/encrypt';
        }
        else if (name === "Contact Us") {
            path = 'contactus';
        }
        if (history.length > 0 && history.location.pathname !== path) {
            history.push(path);
        }

        setSelectedNavItem(name);
    }

    const drawer = (
        <div>
            <div>
                <Divider />
                <List>
                    {['Videos', 'Publish'].map((anchor, text) => (
                        <ListItem button key={anchor} selected={anchor === selectedNavItem} onClick={() => { navigateContent(anchor) }}>
                            <ListItemText primary={anchor} />
                        </ListItem>
                    ))}
                </List>
                <Divider />
                <List>
                    {['Encrypt Videos', 'Contact Us'].map((anchor, text) => (
                        <ListItem button key={anchor} selected={anchor === selectedNavItem} onClick={() => { navigateContent(anchor); }}>
                            <ListItemText primary={anchor} />
                        </ListItem>
                    ))}
                </List>
            </div>
        </div>
    )
    return (
        <div>
            <AppBar position='fixed'>
                <Toolbar style={{ justifyContent: 'space-between' }}>
                    <Hidden smUp implementation="css">
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge='start'
                            onClick={handleSmallDevice}
                        >  <MenuIcon />
                        </IconButton>
                        <Drawer
                            classes={{
                                paper: classes.drawer,
                            }}
                            open={state}
                            onClose={handleSmallDevice}
                        >
                            {drawer}
                        </Drawer>
                        <Typography component="span" variant="h6" className={classes.title}>
                            Welcome to Gaideo
                        </Typography>
                    </Hidden>
                    <Hidden xsDown implementation="css"> <Drawer
                        classes={{
                            paper: classes.drawer,
                        }}
                        open
                        variant='permanent'
                    >
                        {drawer}
                    </Drawer>
                        <Typography variant="h6" className={classes.title} style={{ paddingLeft: 250 }}>
                            Welcome to Gaideo, a privacy-based video sharing platform
                        </Typography>
                    </Hidden>
                    {
                        userSession?.isUserSignedIn() ?
                            (
                                <div>
                                    <IconButton
                                        onClick={handleClick}
                                        color="inherit"
                                    >
                                        <AccountCircle />
                                    </IconButton>
                                    <Menu
                                        id="menu-appbar"
                                        anchorEl={anchorEl}
                                        anchorOrigin={{
                                            vertical: 'top',
                                            horizontal: 'right',
                                        }}
                                        keepMounted
                                        transformOrigin={{
                                            vertical: 'top',
                                            horizontal: 'right',
                                        }}
                                        open={open}
                                        onClose={handleClose}
                                    >
                                        <MenuItem onClick={() => { handleMenu("profile") }}>Profile</MenuItem>
                                        <MenuItem onClick={() => { handleMenu("logout") }}>Logout</MenuItem>
                                    </Menu>
                                </div>
                            ) :
                            (
                                <Button style={{ marginTop: 3 }} color="inherit" onClick={async () => {
                                    await doOpenAuth(authOptions);
                                    if (userSession?.isSignInPending()) {
                                        setUserData(await userSession.handlePendingSignIn());
                                    }
                                }}>Login</Button>
                            )
                    }
                </Toolbar>
            </AppBar>
            {userSession?.isUserSignedIn() &&
                <div className={classes.content}>
                    <ContentPane />
                </div>
            }
        </div>
    );
}