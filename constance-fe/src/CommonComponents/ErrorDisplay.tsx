
import { ErrorOutline } from "@mui/icons-material";
import { Stack, Typography, Box, Button, Link } from "@mui/material";
import { confirmAlert } from "react-confirm-alert";
import { ErrorSeverityValue, SPECIAL_DARK_GOLD_COLOR, SPECIAL_RED_COLOR } from "../DataModels/Constants";
import { useRouteError } from "react-router-dom";


export function DisplayError(errCode: string, errSeverity: string, errMessage: string) {

    confirmAlert({
        customUI: ({ onClose }) => {
            if (errMessage) {
                let extLink = `ERROR_WIKI_PREFIX${errCode}`

                let severityColor : string = "";
                if(errSeverity.toLowerCase() === ErrorSeverityValue.FATAL.toString().toLowerCase()) {
                    severityColor = SPECIAL_RED_COLOR;
                }
                else if (errSeverity.toLowerCase() === ErrorSeverityValue.ERROR.toString().toLowerCase()) {
                    severityColor = SPECIAL_RED_COLOR;
                }
                else if (errSeverity.toLowerCase() === ErrorSeverityValue.WARNING.toString().toLowerCase()) {
                    severityColor = SPECIAL_DARK_GOLD_COLOR;
                }


                return (
                    <div className='react-confirm-alert-body'>
                        <Stack direction="row" alignItems="center" gap={1}>
                            <ErrorOutline style={{ fontSize: '48px', color: severityColor }} />
                            <Typography component={'span'} variant="h2">Error</Typography>
                        </Stack>
                        <hr />
                        <Box>

                            <span>
                                <span style={{ fontWeight: 'bold' }}>ERROR CODE: </span> 
                                <Link target="_blank" rel="noopener" href={extLink}>{errCode ?? ''}</Link>
                            </span>
                            <br />
                            <span>
                                <span style={{ fontWeight: 'bold' }}>ERROR SEVERITY: </span> 
                                <span style={{color: severityColor }}>{errSeverity ?? ''}</span>
                            </span>
                            <br />
                            <span>
                                <span style={{ fontWeight: 'bold' }}>ERROR MESSAGE: </span>
                                <span>{errMessage ?? ''}</span>
                            </span>

                        </Box>
                        <hr />
                        <Button sx={{ minWidth: 100, color: 'white', backgroundColor: 'gray', ':hover': { bgcolor: 'darkgray' }, }} onClick={() => onClose()}>OK</Button>
                    </div>
                );
            }
            else {
                return (<></>);
            }
        }
    });
}











export default function Error404Page() {
  const error : any = useRouteError();
  console.error(error);

  return (
    <div id="error-page">
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
}