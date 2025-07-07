import { NodeModel } from "@minoru/react-dnd-treeview";
import { useTheme } from "@mui/material/styles";
import { tokens } from "../theme";
import { useCallback } from "react";
import { ArrowRight, Check, FilterTiltShiftOutlined, MemoryOutlined } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { alpha } from '@mui/material/styles';


interface TreeNodeProps {
    node: NodeModel<any>,
    depth: number,
    isOpen: boolean,
    isSelected: boolean,
    onToggle: (id: NodeModel["id"]) => void,
    onContextMenu: (e:any, node:NodeModel<any>, depth:number) => void,
    onTreeNodeSelected: (node: NodeModel<any>) => void,
};


const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, isOpen, onToggle, onContextMenu, onTreeNodeSelected, isSelected = false}) => {

    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const indent = depth * 1;
    let isIface = node.parent.toString() === "0" ? true : false;


    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle(node.id);
    };


    const handleSelection = useCallback((node: NodeModel<any>): void => {
        if(node) {
            if(onTreeNodeSelected) {
                onTreeNodeSelected(node);
            }
        }
    }, [])

    
    const handleDoubleClickAction = useCallback((node: NodeModel<any>): void => {
        if(node) {
            if(onTreeNodeSelected) {
                onTreeNodeSelected(node);
            }
        }
    }, [])




    return (
        <Box display="flex" flexDirection="row" justifyContent="left" alignItems="center" sx={{ml: 2, paddingLeft: isIface ? 1 : 4}}>
            <Box sx={{ ml: isOpen ? 1 : 0, mr: 1, alignItems: "center", fontSize: 0, cursor: "pointer", height: 24, justifyContent: "center", width: 24, 
                transition: 'transform linear .1s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                {(isIface === true)
                    ? (<Box onClick={handleToggle}> <ArrowRight sx={{fontSize: 33}}/> </Box> )
                    : (<></>)}
            </Box>
            <Box display="flex" flexDirection="row" justifyContent="left" alignItems="center" onContextMenu={(e) => onContextMenu(e, node, depth)}
                sx={{ 
                    borderLeft: `1px dashed ${alpha(theme.palette.text.primary, 0.4)}`, 
                    paddingTop: .8, 
                    borderRadius: 2, 
                    minWidth: 400, 
                    paddingInlineStart: indent, 
                    // backgroundColor: (isSelected || isRightClicked) ? colors.primary[500] : ''
                    backgroundColor: (isSelected) ? colors.primary[500] : ''
                }}>
                
                {/* Icon for node */}
                <Box>
                    {(isIface === true) 
                        ? <MemoryOutlined onClick={handleToggle} sx={{fontSize: 20, color: colors.blueAccent[100] }}/>
                        : <FilterTiltShiftOutlined onDoubleClick={() => handleDoubleClickAction(node)} onClick={() => handleSelection(node)} sx={{fontSize: 14, color: colors.grey[100] }}/>
                    }
                </Box>

                {/* Text for node */}
                <Box display="flex" flexDirection="row" justifyContent="space-between" 
                    sx={{ width: "100%", paddingInlineStart: 1}} 
                    onDoubleClick={() => handleDoubleClickAction(node)}
                    onClick={() => handleSelection(node)} >
                    <Typography sx={{ mt: isIface ? -.6 : -1, color: isIface? colors.greenAccent[400] : undefined, fontSize: isIface ? "16px" : "14px" }}>
                        {node.text}
                    </Typography>
                    
                    {/* check mark for selected node for node */}
                    {isSelected && <Check fontSize="small" sx={{ marginLeft: 1 }} />}
                    
                </Box>
            </Box>
        </Box>
        
    );
};


export default TreeNode