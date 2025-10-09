import * as React from 'react';
import { useTheme } from "@mui/material/styles";
import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Grow from '@mui/material/Grow';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Stack from '@mui/material/Stack';
import { Box, Divider, IconButton, ListItemIcon, SvgIconTypeMap, Tooltip } from '@mui/material';
import { Settings, SettingsOutlined, SvgIconComponent, Thunderstorm, Visibility, Warning, WarningAmber } from '@mui/icons-material';
import { SPECIAL_BLUE_COLOR, SPECIAL_DARK_GOLD_COLOR, SPECIAL_DARKMODE_TEXTFIELD_COLOR, SPECIAL_DEEPER_QUARTZ_COLOR, SPECIAL_QUARTZ_COLOR, SPECIAL_RED_COLOR } from '../DataModels/Constants';
import { Fragment } from 'react';
import { tokens } from '../theme';
import { BasicKVP, MenuInfo } from '../DataModels/ServiceModels';
import { OverridableComponent } from '@mui/material/OverridableComponent';



interface MenuListCompositionProps {
    menuItems: MenuInfo[],  //Map<string, [SvgIconComponent|null, ((event: Event | React.SyntheticEvent, label: string) => void)]>,
    tooltipTitle?: string,
    icon?: any, 
    disableRipple?: boolean,
    iconSize?: "small" | "medium" | "large",
    menuListBGColor?: string,
    menuListHoverColor?: string,
    disabled?: boolean,
    disableAnimation?: boolean,
    setMenuBorder?: boolean,
    padding?: number
    onMenuListClosed?: () => void
}


const MenuListComposition: React.FC<MenuListCompositionProps> = ({ menuItems, icon, menuListBGColor=SPECIAL_QUARTZ_COLOR, menuListHoverColor, onMenuListClosed, padding, 
    tooltipTitle="", setMenuBorder=false, disableRipple=false, iconSize="large", disabled = false, disableAnimation = false }) => {
    const [open, setOpen] = React.useState(false);
    const anchorRef = React.useRef<HTMLButtonElement>(null);
    const prevOpen = React.useRef(open);
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);


    const handleToggle = () => {
        setOpen((prevOpen) => !prevOpen);
    };


    const handleClose = (event: Event | React.SyntheticEvent) => {
        if ( anchorRef.current && anchorRef.current.contains(event.target as HTMLElement) ) {
            return;
        }
        if(onMenuListClosed) {
            onMenuListClosed();
        }
        setOpen(false);
    };


    function handleListKeyDown(event: React.KeyboardEvent) {
        if (event.key === 'Tab') {
            event.preventDefault();
            setOpen(false);
        } 
        else if (event.key === 'Escape') {
            setOpen(false);
        }
    }

    
    // return focus to the button when we transitioned from !open -> open
    React.useEffect(() => {
        if (prevOpen.current === true && open === false) {
            anchorRef.current!.focus();
        }
        prevOpen.current = open;
    }, [open]);




    return (
        //the Z index is important -- forces the dropDown to be on top of other components
        <Box sx={{ ml: 1, mr: 1, zIndex: 10 }}>
            <div>
                <Tooltip placement="top" title={tooltipTitle}>
                    <span>
                        <IconButton 
                            ref={anchorRef}
                            id="composition-button"
                            aria-controls={open ? 'composition-menu' : undefined}
                            aria-expanded={open ? 'true' : undefined}
                            aria-haspopup="true"
                            disableRipple={disableRipple}
                            sx={{
                                padding: padding,
                                backgroundColor: disableRipple ? undefined : SPECIAL_DARKMODE_TEXTFIELD_COLOR,
                                "@keyframes rotate": {
                                    "0%": {
                                        transform: "rotate(0deg)",
                                    },
                                    "100%": {
                                        transform: "rotate(520deg)",
                                    },
                                },
                                animation: (disableAnimation === true) ? undefined : "rotate 1s"
                            }}
                            
                            disabled={disabled}
                            onClick={handleToggle}>
                            {(icon) ? <>{icon}</> : <SettingsOutlined sx={{padding: 0}} fontSize={iconSize} color="secondary"/>}
                        </IconButton>
                    </span>
                </Tooltip>

                <Popper open={open} anchorEl={anchorRef.current} role={undefined} placement="bottom-start" transition disablePortal>
                    {({ TransitionProps, placement }) => (
                        <Grow style={{ transformOrigin: (placement === 'bottom-start') ? 'left top' : 'left bottom' }} {...TransitionProps}>
                            <Paper key={`pp-pp-1`}>
                                <ClickAwayListener onClickAway={handleClose}>
                                    <MenuList sx={{
                                            zIndex: 1000,
                                            border: setMenuBorder ? 1: undefined, borderStyle: setMenuBorder ? 'dotted' : undefined, borderColor: SPECIAL_DARK_GOLD_COLOR, padding: .5, 
                                            backgroundColor: menuListBGColor, ':hover': { bgcolor: menuListHoverColor}
                                        }} 
                                        dense 
                                        autoFocusItem={open} 
                                        id="composition-menu" aria-labelledby="composition-button" onKeyDown={handleListKeyDown}>
                                        <Divider style={{marginTop: 0, marginBottom: 0, padding: 0}}/>
                                        {menuItems.map((info: MenuInfo, index: number) => (
                                            <Fragment key={`fg-${index}`}>
                                                <MenuItem key={`mi-${index}`} onClick={(e) => {
                                                    if(info.callbackAction) {
                                                        info.callbackAction({key: info.label, value: [index, e]} as BasicKVP);
                                                    }
                                                    handleClose(e);
                                                }}>
                                                    <ListItemIcon>
                                                        {info.icon}
                                                    </ListItemIcon>
                                                    <>
                                                        <span>
                                                            <span style={{fontSize: 13, color: (info.indicateWarning && info.indicateWarning === true) ? SPECIAL_RED_COLOR: undefined}}>{info.label}</span>
                                                            {(info.indicateWarning && info.indicateWarning === true) && <WarningAmber sx={{color: SPECIAL_RED_COLOR, ml: 2, fontSize: 14}}/>}
                                                        </span>
                                                    </>
                                                </MenuItem>
                                                <Divider style={{marginTop: 0, marginBottom: 0, padding: 0}}/>
                                            </Fragment>
                                        ))}

                                    </MenuList>
                                </ClickAwayListener>
                            </Paper>
                        </Grow>
                    )}
                </Popper>
            </div>
        </Box>
    );
}


export default MenuListComposition









// "@keyframes rotate": {
//     "0%": {
//         transform: "rotate(0deg)",
//     },
//     "50%": {
//         transform: "rotate(360deg)",
//     },
//     "100%": {
//         transform: "rotate(720deg)",
//     },
// },

//======================================================================================


{/* <MenuItem onClick={handleClose}>Profile</MenuItem>
<MenuItem onClick={handleClose}>My account</MenuItem>
<MenuItem onClick={handleClose}>Logout</MenuItem> */}





// export default function MenuListComposition( {menuItems: Map<string, ((event: Event | React.SyntheticEvent, label: string) => void)>} {




{/* <Button
    ref={anchorRef}
    id="composition-button"
    aria-controls={open ? 'composition-menu' : undefined}
    aria-expanded={open ? 'true' : undefined}
    aria-haspopup="true"
    onClick={handleToggle}
>
    Dashboard
</Button> */}

//===========================================================

// import * as React from 'react';
// import Paper from '@mui/material/Paper';
// import Divider from '@mui/material/Divider';
// import MenuList from '@mui/material/MenuList';
// import MenuItem from '@mui/material/MenuItem';
// import ListItemIcon from '@mui/material/ListItemIcon';
// import ListItemText from '@mui/material/ListItemText';
// import Check from '@mui/icons-material/Check';

// export default function DenseMenu() {


//     return (
//         <Paper sx={{ width: 320 }}>
//             <MenuList dense>
//                 <MenuItem>
//                     <ListItemText inset>Single</ListItemText>
//                 </MenuItem>
//                 <MenuItem>
//                     <ListItemText inset>1.15</ListItemText>
//                 </MenuItem>
//                 <MenuItem>
//                     <ListItemText inset>Double</ListItemText>
//                 </MenuItem>
//                 <MenuItem>
//                     <ListItemIcon>
//                         <Check />
//                     </ListItemIcon>
//                     Custom: 1.2
//                 </MenuItem>
//                 <Divider />
//                 <MenuItem>
//                     <ListItemText>Add space before paragraph</ListItemText>
//                 </MenuItem>
//                 <MenuItem>
//                     <ListItemText>Add space after paragraph</ListItemText>
//                 </MenuItem>
//                 <Divider />
//                 <MenuItem>
//                     <ListItemText>Custom spacing...</ListItemText>
//                 </MenuItem>
//             </MenuList>
//         </Paper>
//     );
// }