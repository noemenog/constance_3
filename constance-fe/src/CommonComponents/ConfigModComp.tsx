import {Alert, AlertColor, Box, Divider, IconButton, InputBase, Slide, Tooltip, Typography, useTheme } from "@mui/material";
import { tokens } from "../theme";
import styled from '@emotion/styled';
import { useCStore } from "../DataModels/ZuStore";
import { Editor, Monaco } from "@monaco-editor/react";
import { AppInfo, Bucket, ConfigItem, LoadingSpinnerInfo, LoggedInUser } from "../DataModels/ServiceModels";
import { ChangeEvent, Fragment, useEffect, useRef, useState } from "react";
import { CheckCircleOutline, AddCircleOutlined, BuildCircleOutlined, MoveUpOutlined, CopyAllOutlined, LockOutlined, LockOpenOutlined, DeleteForeverOutlined, SearchOutlined, AddHomeOutlined, PlaylistAddCheckCircleOutlined, PlaylistAddOutlined } from "@mui/icons-material";
import { SPECIAL_RED_COLOR } from "../DataModels/Constants";





interface ConfigModCompProps {
    appInfo: AppInfo,
    disableConfigDependentActions: boolean,
    disableConfigPlacementControls: boolean,
    onSearchFieldTextChange: (event: any) => void,
    onSaveAction: () => void,
    onLockAction: () => void,
    onDeleteAction?: () => void,
    onAddAction?: () => void,
    onCompareAction: (targetEnv: string|null) => void,
    onMoveAction: (targetBucketId: string|null) => void,
    onCopyAction: (targetBucketId: string|null) => void,
}



const ConfigModComp: React.FC<ConfigModCompProps> = ({ appInfo, disableConfigDependentActions, disableConfigPlacementControls, 
    onSaveAction, onDeleteAction, onCompareAction, onLockAction, onMoveAction, onCopyAction, onAddAction, onSearchFieldTextChange }) => {
    
    const theme : any = useTheme();
    const colors : any = tokens(theme.palette.mode);

    const containerRef = useRef<any>();
    
    
    function handleSaveAction(event: any): void {
        if(onSaveAction) {
            onSaveAction();
        }
    }

    function handleDeleteAction(event: any): void {
        if(onDeleteAction) {
            onDeleteAction();
        }
    }

    function handleCompareAction(event: any): void {
        if(onCompareAction) {
            onCompareAction(null);
        }
    }

    function handleLockAction(event: any): void {
        if(onLockAction) {
            onLockAction();
        }
    }

    function handleMoveAction(event: any): void {
        if(onMoveAction) {
            onMoveAction(null);
        }
    }

    function handleCopyAction(event: any): void {
        if(onCopyAction) {
            onCopyAction(null);
        }
    }

    function handleAddAction(event: any): void {
        if(onAddAction) {
            onAddAction();
        }
    }

    function handleSearchFieldTextChange(event: any): void {
        if(onSearchFieldTextChange) {
            onSearchFieldTextChange(event);
        }
    }





    return (
        <Box width="100%" flexGrow={1}>                
            <Box sx={{display:"flex", flexDirection:"row", alignItems:"center", justifyContentsx: "center", alignSelf: "center", width:"100%", m: 1, mt:2}}>
                                
                <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                    <Divider orientation="vertical" sx={{height: 25, marginRight: 1 }} />
                </Slide>

                <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", padding: 0}}>
                    <Tooltip placement="top" title={`Update core app info & settings`}>
                        <span>
                            <IconButton onClick={handleSaveAction} disabled={disableConfigDependentActions}>
                                <CheckCircleOutline fontSize="small" color={disableConfigDependentActions ? "disabled" : "secondary"}/>
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography sx={{ fontSize: 11, cursor: "pointer" }} onClick={handleSaveAction}>Save</Typography>
                </Box>
                                
                <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                    <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                </Slide>

                { (disableConfigPlacementControls === false) && 
                    <Fragment>
                        <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", padding: 0}}>
                            <Tooltip placement="top" title={`Update core app info & settings`}>
                                <span>
                                    <IconButton onClick={handleAddAction}>
                                        <PlaylistAddOutlined fontSize="small" color="secondary"/>
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11, cursor: "pointer" }} onClick={handleAddAction}>Add</Typography>
                        </Box>
                        
                        <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                        </Slide>

                        <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", padding: 0}}>
                            <Tooltip placement="top" title={`Update core app info & settings`}>
                                <span>
                                    <IconButton onClick={handleCopyAction} disabled={disableConfigDependentActions}>
                                        <BuildCircleOutlined fontSize="small" color={disableConfigDependentActions ? "disabled" : "secondary"}/>
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11, cursor: "pointer" }} onClick={handleCopyAction}>Copy</Typography>
                        </Box>
                        
                        <Slide timeout={{ enter: 800, exit: 400 }} direction="right" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                        </Slide>

                        <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                            <Tooltip placement="top" title={`Export all buckets to a different environment`}>
                                <span>
                                    <IconButton onClick={handleMoveAction} disabled={disableConfigDependentActions}>
                                        <MoveUpOutlined fontSize="small" color={disableConfigDependentActions ? "disabled" : "secondary"} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11, cursor: "pointer" }} onClick={handleMoveAction}>Move</Typography>
                        </Box>

                        <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                        </Slide>

                        <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                            <Tooltip placement="top" title={`Delete`}>
                                <span>
                                    <IconButton onClick={handleDeleteAction} disabled={disableConfigDependentActions}>
                                        <DeleteForeverOutlined fontSize="small" color={disableConfigDependentActions ? "disabled" : "secondary"}/>
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Typography sx={{ fontSize: 11, cursor: "pointer" }} onClick={handleDeleteAction}>Delete</Typography>
                        </Box>
                        
                        <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                            <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                        </Slide>
                    </Fragment> 
                }
                
                <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                    <Tooltip placement="top" title={`Compare`}>
                        <span>
                            <IconButton onClick={handleCompareAction} disabled={disableConfigDependentActions}>
                                <CopyAllOutlined fontSize="small" color={disableConfigDependentActions ? "disabled" : "secondary"}/>
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography sx={{ fontSize: 11, cursor: "pointer" }} onClick={handleCompareAction}>Compare</Typography>
                </Box>

                <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                    <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 1 }} />
                </Slide>

                <Box sx={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                    <Tooltip placement="top" title={(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock`: `Lock`}>
                        <span>
                            <IconButton onClick={handleLockAction}>
                                {(appInfo.lockedBy && appInfo.lockedBy.length > 0)
                                    ? <LockOutlined fontSize="small" sx={{ color: SPECIAL_RED_COLOR}} />
                                    : <LockOpenOutlined fontSize="small" color="secondary"/>
                                }
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography sx={{ fontSize: 11, cursor: "pointer" }} onClick={handleLockAction}>{(appInfo.lockedBy && appInfo.lockedBy.length > 0) ? `Unlock`: `Lock`}</Typography>
                </Box>

                <Slide timeout={{ enter: 800, exit: 400 }} direction="left" in={true} container={containerRef.current}>
                    <Divider orientation="vertical" sx={{height: 25, marginLeft: 2, marginRight: 3 }} />
                </Slide>

                <Box display="flex" sx={{ backgroundColor: colors.primary[400], width: (disableConfigPlacementControls === false) ? "61%" : "81.5%"}}>
                    <InputBase size="small" sx={{ ml: 2, flex: 1}}  placeholder="Search" onChange={handleSearchFieldTextChange}/>
                    <IconButton sx={{ p: '5px' }}>
                        <SearchOutlined />
                    </IconButton>
                </Box>
                
                <Divider orientation="vertical" sx={{height: 30, ml: 1}} />
            </Box>
        </Box>
    );
}

export default ConfigModComp



