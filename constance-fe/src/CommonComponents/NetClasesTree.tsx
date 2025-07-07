import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Tree, getBackendOptions, MultiBackend, DropOptions, NodeModel } from "@minoru/react-dnd-treeview";
import { DndProvider } from "react-dnd";
import { useNavigate } from "react-router-dom";
import { tokens } from "../theme";
import { useTheme } from "@mui/material/styles";
import { Box, Button, Divider, IconButton, List, Switch, Tooltip, Typography } from "@mui/material";
import { Check, CheckCircle, CheckCircleOutline, UnfoldLessDoubleOutlined, UnfoldMoreDoubleOutlined } from "@mui/icons-material";
import css from '@emotion/styled';
import { alpha } from '@mui/material/styles';
import styled from "@emotion/styled";
import ConfirmationDialog, { ConfirmationDialogActionType, ConfirmationDialogProps } from "../FormDialogs/ConfirmationDialog";
import { useDisclosure } from "@mantine/hooks";
import { BasicKVP } from "../DataModels/HelperModels";
import { Interface, Netclass } from "../DataModels/ServiceModels";
import { useSpiderStore } from "../DataModels/ZuStore";
import TreeNode from "./TreeNode";
import { SPECIAL_DARKMODE_TEXTFIELD_COLOR } from "../DataModels/Constants";
import { groupBy } from "../BizLogicUtilities/UtilFunctions";
import { sort } from "fast-sort";




interface NetClasesTreeProps {
    onNodeSelected: (node: NodeModel<any>, isInterface: boolean) => void,
    selectedNode: NodeModel<any> | null, 
    outerContainerRef: any,
    handleDropAction: (setter: any, newTreeData: NodeModel<any>[], options: DropOptions<any>) => void,
    handleContextMenuAction: (event: any, node: NodeModel<any>, isInterface: boolean, depth: number) => void,
    interfaceList: Interface[],
    netclasses: Netclass[],
    enableDragDrop: boolean,
    isAlphabeticalNetclassOrder: boolean,
    onTreeNodeOrderChange: (checked: boolean) => void
    openNetclassTreeNodes: string[],
    onChangeOpenNetclassTreeNodes: (newOpenIds: string[]) => void
}

const NetClasesTree: React.FC<NetClasesTreeProps> = ({ onNodeSelected, handleContextMenuAction, interfaceList, netclasses, enableDragDrop, 
    selectedNode, isAlphabeticalNetclassOrder, onTreeNodeOrderChange, openNetclassTreeNodes, onChangeOpenNetclassTreeNodes, handleDropAction, outerContainerRef }) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);

    const [treeData, setTreeData] = useState<NodeModel<any>[]>([])
    
    const [confirmationModalState, confirmationModalActioner] = useDisclosure(false);
    const [confirmationDialogProps, setConfirmationDialogProps] = useState<ConfirmationDialogProps>();
    
    const netclassMappingRef = useRef<Map<string, Netclass>>(new Map<string, Netclass>());
    const ref = useRef<any>();

    useEffect(() =>{
        let ncMapping = new Map<string, Netclass>();
        let allNodes = new Array<NodeModel<any>>();
        let ifaceNodes = new Array<NodeModel<any>>();
        if (interfaceList && interfaceList.length > 0) {
            for (let i = 0; i < interfaceList.length; i++) {
                let ifaceTN: NodeModel<any> = {
                    id: interfaceList[i]._id.toString(),
                    parent: 0,
                    text: interfaceList[i].name,
                    droppable: enableDragDrop,
                };
                ifaceNodes.push(ifaceTN);
            }
        }
        let ncNodes = new Array<NodeModel<any>>();
        if (netclasses && netclasses.length > 0) {
            for (let x = 0; x < netclasses.length; x++) {
                let ncid = netclasses[x]._id.toString();
                let ncIfaceId = netclasses[x].interfaceId;
                
                ncMapping.set(ncid, netclasses[x])
                
                if (ncIfaceId && ncIfaceId.length > 0) {
                    let ncTN: NodeModel<any> = {
                        id: ncid,
                        parent: ncIfaceId,
                        text: netclasses[x].name,
                        droppable: false,
                    };
                    ncNodes.push(ncTN);
                }
            }
        }
        
        netclassMappingRef.current = ncMapping;
        allNodes = [...ifaceNodes, ...ncNodes];
        setTreeData(allNodes);
    }, [interfaceList, netclasses])


    const handleOpenAll = () => ref.current.openAll();
    const handleCloseAll = () => ref.current.closeAll();
    

    const handleContextMenu = useCallback((event: any, node: NodeModel<any>, depth: number): void => {
        let isInterface = (node.parent.toString() === "0") ? true : false;
        if(handleContextMenuAction) {
            handleContextMenuAction(event, node, isInterface, depth)
        }
    }, [])


    const handleNodeSelection = useCallback((node: NodeModel<any>): void => {
        if(onNodeSelected) {
            let isInterface = (node.parent.toString() === "0") ? true : false;
            onNodeSelected(node, isInterface)
        }
    }, [])


    function handleChangeOpenEvent(newOpenIds: (string | number)[]): void {
        if(onChangeOpenNetclassTreeNodes) {
            onChangeOpenNetclassTreeNodes(newOpenIds as string[])
        }
    }


    function handleNetclassOrdering(event: ChangeEvent<HTMLInputElement>, checked: boolean): void {
        if(checked !== undefined) {
            if(onTreeNodeOrderChange) {
                onTreeNodeOrderChange(checked);
            }
        }
    }


    function sortAlphabetically(a: NodeModel<any>, b: NodeModel<any>) : number {
        return (a.text < b.text ? -1 : 1);  //real real
    }


    function sortByPatternId(first: NodeModel<any>, second: NodeModel<any>) : number {
        let firstNodeIsInterface = first.parent.toString() === "0" ? true : false;
        let secondNodeIsInterface = second.parent.toString() === "0" ? true : false;

        if(netclassMappingRef && netclassMappingRef.current && firstNodeIsInterface === false && secondNodeIsInterface === false) {
            let firstNodePatternIndex = netclassMappingRef.current.get(first.id as string)?.patternIndex as number
            let secondNodePatternIndex = netclassMappingRef.current.get(second.id as string)?.patternIndex as number
            return (firstNodePatternIndex < secondNodePatternIndex ? -1 : 1);
        }
        else {
            return (first.text < second.text ? -1 : 1); 
        }        
    }





    return (
        <Box display="flex" flexDirection="row" justifyContent="space-between">
            <DndProvider backend={MultiBackend} options={getBackendOptions()}>
                <Tree
                    ref={ref}
                    sort={isAlphabeticalNetclassOrder ? sortAlphabetically : sortByPatternId}
                    enableAnimateExpand={true}
                    tree={treeData}
                    initialOpen={openNetclassTreeNodes}
                    onChangeOpen={handleChangeOpenEvent}
                    listComponent={List}
                    rootId={0}
                    onDrop={(tree, options) => {}} //Important - Drag/Drop is effectively DISABLED
                    classes={{
                        root: "nctree-root",
                        draggingSource: "nctree-dragging-source",
                        dropTarget: "nctree-drop-target",
                        container: "nctree-list-node",
                        listItem: "nctree-list-node"
                      }}
                    render={(node, { depth, isOpen, onToggle }) => (
                        <TreeNode 
                            onContextMenu={handleContextMenu}
                            node={node}
                            depth={depth}
                            isOpen={isOpen}
                            isSelected={(selectedNode && selectedNode?.id === node.id) ? true : false}
                            onToggle={onToggle}
                            onTreeNodeSelected={handleNodeSelection} />
                    )}
                />
            </DndProvider>

            <Box alignItems="right" >
                <Box display="flex" flexDirection="row" >
                    {(openNetclassTreeNodes && openNetclassTreeNodes.length > 0) && <>
                        <Tooltip placement="top" 
                            title={isAlphabeticalNetclassOrder 
                                ? `Turn off to order net-classes according to AutoMaping sequence` 
                                : `Turn on to order net-classes alphabetically`}>
                            <Switch 
                                checked={isAlphabeticalNetclassOrder} 
                                checkedIcon={<CheckCircle sx={{mt: -.3}}/>} 
                                color="secondary" 
                                size="small" 
                                onChange={handleNetclassOrdering}
                                sx={{ mt: 1, mr: -1 }} 
                            />
                        </Tooltip>
                    <Divider orientation="vertical" sx={{height: 20, marginLeft: 1, marginRight: 1, alignSelf: "center" }} /></>
                    }<Tooltip placement="top" title={`Expand All`}>
                        <IconButton onClick={handleOpenAll} sx={{backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
                            <UnfoldMoreDoubleOutlined color="secondary"/>
                        </IconButton>
                    </Tooltip>
                    <Divider orientation="vertical" sx={{height: 20, marginLeft: 1, marginRight: 1, alignSelf: "center" }} />
                    <Tooltip placement="top" title={`Collapse All`}>
                        <IconButton onClick={handleCloseAll} sx={{mr: .5, backgroundColor: SPECIAL_DARKMODE_TEXTFIELD_COLOR}}>
                            <UnfoldLessDoubleOutlined color="secondary" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {confirmationModalState && <ConfirmationDialog opened={confirmationModalState} close={confirmationModalActioner.close} {...confirmationDialogProps as ConfirmationDialogProps} /> }
            
        </Box>
    );
}


export default NetClasesTree















// const netclassMapping = useMemo(() => {         
//     let map = new Map<string, Netclass>();
//     for(let nc of netclasses) {
//         map.set(nc._id, nc)
//     }
//     return map;
// }, []);


//========================================


// function organizeTreeData(sortNetclassesAlphabetically: boolean) {
//     let allNodes = new Array<NodeModel<any>>();

//     let ifaceNodes = new Array<NodeModel<any>>();
//     if (interfaceList && interfaceList.length > 0) {
//         for (let i = 0; i < interfaceList.length; i++) {
//             let ifaceTN: NodeModel<any> = {
//                 id: interfaceList[i]._id.toString(),
//                 parent: 0,
//                 text: interfaceList[i].name,
//                 droppable: enableDragDrop,
//             };
//             ifaceNodes.push(ifaceTN);
//         }
//     }

//     let ncNodes = new Array<NodeModel<any>>();
//     // let ncMapping = new Map<string, Netclass>();
//     if (netclasses && netclasses.length > 0) {
//         for (let x = 0; x < netclasses.length; x++) {
//             let ncid = netclasses[x]._id.toString();
//             let ncIfaceId = netclasses[x].interfaceId;
//             // ncMapping.set(ncid, netclasses[x]);
//             if (ncIfaceId && ncIfaceId.length > 0) {
//                 let ncTN: NodeModel<any> = {
//                     id: ncid,
//                     parent: ncIfaceId,
//                     text: netclasses[x].name,
//                     droppable: false,
//                 };
//                 ncNodes.push(ncTN);
//             }
//         }
//     }

//     // if(sortNetclassesAlphabetically) {
//     //     allNodes = [...ifaceNodes, ...ncNodes];
//     //     allNodes = sort(allNodes).asc(a => a.text);
//     // }
//     // else {
//     //     let revisedNCNodeArray = new Array<NodeModel<any>>();
//     //     let grouped : Map<string|number, NodeModel<any>[]> = groupBy(ncNodes, a => a.parent);
//     //     for(let [parentId, nodeArray] of grouped) {
//     //         let sortedSubset = sort(nodeArray).asc(x => (ncMapping.get(x.id.toString()) as Netclass).patternIndex)
//     //         for(let item of sortedSubset) {
//     //             revisedNCNodeArray.push(item);
//     //         }
//     //     }
//     //     ifaceNodes = sort(ifaceNodes).asc(a => a.parent);
//     //     allNodes = [...ifaceNodes, ...revisedNCNodeArray];
//     // }

//     allNodes = [...ifaceNodes, ...ncNodes];
//     setTreeData(allNodes);
// }


//===================================================================


{/* <Box sx={{textAlign:"right" }} >
    <Tooltip placement="top" title={`Expand All`}>
        <IconButton onClick={handleOpenAll}>
            <UnfoldMoreDoubleOutlined color="secondary"/>
        </IconButton>
    </Tooltip>
    <Tooltip placement="top" title={`Collapse All`}>
        <IconButton onClick={handleCloseAll}>
            <UnfoldLessDoubleOutlined color="secondary"/>
        </IconButton>
    </Tooltip>
</Box> */}



    // const [tempSort, setTempSort] = useState<boolean>(false)




    
            // if(checked === true) {
            //     organizeTreeData(true);
            //     setIsAlphabeticalNetclassTreeData(true)
            // }
            // else {
            //     organizeTreeData(false);
            //     setIsAlphabeticalNetclassTreeData(false)
            // }


      //============================================================================
      
      
    
    // function handleDrop(newTreeData: NodeModel<any>[], options: DropOptions<any>): void {
    //     if(enableDragDrop === true) {
    //         let info = { newTreeData: newTreeData, options: options } as any
    //         let dropConfirm: ConfirmationDialogProps = {
    //             onFormClosed: onConfirmationDataAvailable,
    //             title: "Please Confirm",
    //             warningText_main: `Are you sure you want to move netclass '${options.dragSource?.text}' to interface '${options.dropTarget?.text}'?`,
    //             warningText_other: "",
    //             actionButtonText: "Proceed",
    //             enableSecondaryActionButton: false,
    //             secondaryActionButtonText: "",
    //             contextualInfo:  { key: "DROP_ACTION", value: info},
    //         }
    //         setConfirmationDialogProps(dropConfirm)
    //         confirmationModalActioner.open()
    //         setTreeData(newTreeData);
    //     }
    // }


    // function onConfirmationDataAvailable(action: ConfirmationDialogActionType, contextualInfo: BasicKVP): void {
    //     if(contextualInfo && contextualInfo.key) {
    //         if(contextualInfo.key === "DROP_ACTION") {
    //             if(action === ConfirmationDialogActionType.PROCEED) {
    //                 if(handleDropAction) {
    //                     handleDropAction(setTreeData, contextualInfo.value.newTreeData, contextualInfo.value.options)
    //                 }
    //             }
    //         }
    //     }
    // }




    //================================================================

// const [showContextMenu, setShowContextMenu] = useState(false);
    // const [contextMenuXYPosistion, setContextMenuXYPosistion] = useState({ x: 0, y: 0 });
    // const [rightClickedNode, setRightClickedNode] = useState<NodeModel<any> | null>(null)
   
    // const mouseOnContextMenuRef = useRef<boolean>(false);
    



// const ContextMenu = styled.div`
    //     position: absolute;
    //     width: 300px;
    //     background-color: #383838;
    //     border-radius: 5px;
    //     box-sizing: border-box;
    //     ul {
    //         box-sizing: border-box;
    //         padding: 2px;
    //         margin: 0;
    //         list-style: none;
    //     }
    //     ul li {
    //         padding: 5px 22px;
    //     }
    //     /* hover */
    //     ul li:hover {
    //         cursor: pointer;
    //         background-color: #000000;
    //     }
    // `
    
    //TODO: we need a better way to solve this 
    // useEffect(() =>{
    //     if(mouseOnContextMenuRef && mouseOnContextMenuRef.current === false) {
    //         outerContainerRef?.current.addEventListener('click', handleSpecialClick);
    //     }
    //     else {
    //         outerContainerRef?.current.removeEventListener("keyup", handleSpecialClick);
    //     }
    //     return () => outerContainerRef?.current.removeEventListener("keyup", handleSpecialClick);
    // }, [])



    // function handleSpecialClick(){
    //     setContextMenuXYPosistion({ x: 0, y: 0 });
    //     setShowContextMenu(false);
    //     setRightClickedNode(null);
    // }

//================================================================================

    // function handleContextMenuSelection(event: any, action: string): void {
    //     if(rightClickedNode && action && action.length > 0) {
    //         if(handleInterfaceContextMenuAction) {
    //             handleInterfaceContextMenuAction(action, rightClickedNode.id as string)
    //         }
    //     }
    // }


//====================================================================================

/* { showContextMenu && 
    <ContextMenu 
        onMouseOver={(e) => { mouseOnContextMenuRef.current = true}} 
        onMouseLeave={(e) => { mouseOnContextMenuRef.current = false}}
        
        style={{top: contextMenuXYPosistion.y, left: contextMenuXYPosistion.x, padding: 0}}>
        <List dense={true}>
            <ListItem dense divider disablePadding onClick={(e) => handleContextMenuSelection(e, "VIEW")}>
                <ListItemIcon>
                    <DraftsOutlined fontSize="inherit" onClick={(e) => handleContextMenuSelection(e, "VIEW")}/>
                </ListItemIcon>
                <ListItemText primary={`View Details`} onClick={(e) => handleContextMenuSelection(e, "VIEW")}/>
            </ListItem>
            <ListItem dense divider disablePadding onClick={(e) => handleContextMenuSelection(e, "EDIT")}>
                <ListItemIcon>
                    <DraftsOutlined fontSize="inherit" onClick={(e) => handleContextMenuSelection(e, "EDIT")}/>
                </ListItemIcon>
                <ListItemText primary={`Edit Interface/Netclasses`} onClick={(e) => handleContextMenuSelection(e, "EDIT")}/>
            </ListItem>
            <ListItem dense divider disablePadding onClick={(e) => {handleContextMenuSelection(e, "AUTOMAP")}}>
                <ListItemIcon>
                    <DraftsOutlined fontSize="inherit" onClick={(e) => handleContextMenuSelection(e, "AUTOMAP")}/>
                </ListItemIcon>
                <ListItemText primary={`Execute Automap`} onClick={(e) => handleContextMenuSelection(e, "AUTOMAP")}/>
            </ListItem>
        </List>
    </ContextMenu>
            } */

//================================================================


// (e) => handleContextMenuSelection(e, "VIEW")


// <div className={`tree-node cn-root`} style={{ paddingInlineStart: indent }}>
        
        //     <div className={`cn-expandIconWrapper ${ isOpen ? `cn-isOpen` : ""}`}>
        //         {
        //             (isNCNode === true)
        //             ? (<div onClick={handleToggle}> <ArrowRight /> </div> )
        //             : (<></>)
        //         }
        //     </div>
        
        //     <div onContextMenu={(e) => onContextMenu(e, node, depth)}>
        //         {
        //             (isNCNode === true) 
        //             ? <MemoryOutlined onClick={handleToggle} sx={{fontSize: 20, color: colors.blueAccent[100] }}/>
        //             : <FilterTiltShiftOutlined onClick={() => handleSelection(node)} sx={{fontSize: 14, color: colors.grey[100] }}/>
        //         }
        //     </div>

        //     <div 
        //         className={`cn-labelGridItem`} 
        //         style={{backgroundColor: (isSelected || isRightClicked) ? colors.primary[500] : ''}}
        //         onClick={() => handleSelection(node)} 
        //         onContextMenu={(e) => onContextMenu(e, node, depth)}>
                
        //         <Typography 
        //             component={Stack} 
        //             direction="row" 
        //             sx={{
        //                 mt: -.5,
        //                 color: isNCNode? colors.greenAccent[400] : '', 
        //                 fontSize: isNCNode ? "16px" : "14px" 
        //             }}>
        //                 {node.text}{isSelected && <Check fontSize="small" sx={{ marginLeft: 1 }} />}
        //         </Typography>
            
        //     </div>

        // </div>