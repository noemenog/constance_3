import React, { useState } from 'react';
import { Column, ICellRendererParams } from "ag-grid-community";
import { SegmentedControl, Switch } from '@mantine/core';
import { useTheme } from "@mui/material/styles";
import { tokens } from '../theme';
import { StackupLayerTypeEnum } from '../DataModels/Constants';
import { StackupLayer } from '../DataModels/ServiceModels';
import { Property } from 'csstype';



export interface SegmentedCtrlCellRendererProps {
    onToggled?: (value: string, element: any) => void
    disabled?: boolean,
    options: string[],
    selectorColor: Property.BackgroundColor | undefined
}

export const SegmentedCtrlCellRenderer: React.FC<ICellRendererParams & SegmentedCtrlCellRendererProps> =
    ({ value, node, column, onToggled, data, api, disabled, options, selectorColor }) => {

        const theme = useTheme();
        const colors = tokens(theme.palette.mode);

        const [selection, setSelection] = useState(value && value.length > 0 ? value : options[0]);

        function onSelectionChanged (value: string){
            setSelection(value);
            data.routingLayerType = value;
            node.setData(data)
            node.setDataValue(column as Column, value )
            
        }

        return (
            <>
                {
                    (!node.group && data && data.type && data.type === StackupLayerTypeEnum.Metal)
                    ? <SegmentedControl
                        data={[...options]} 
                        value={selection}
                        disabled={disabled ?? false}
                        transitionDuration={250}
                        transitionTimingFunction="linear"
                        size="xs"
                        onChange={onSelectionChanged}
                        color="cyan" //leave this be - it has its use/value!!
                        styles={{
                            root: { display: "flex", padding: 0, height: 30 },  //backgroundColor: colors.grey[300]
                            indicator: { width: 70, alignItems: "center", backgroundColor: selectorColor, verticalAlign: "center" },
                            label: {  display: "flex", alignItems: "center", height: 30 }
                        }}
                    />
                    : <></>
                }
            </>
        );
    }

export default SegmentedCtrlCellRenderer
