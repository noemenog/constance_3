import { ErrorSeverityValue } from "./Constants";


export interface BaseUserInfo {
    email: string,
    idsid: string
}

export interface User extends BaseUserInfo {
    id: string,
    wwid: string
}


export interface LoggedInUser extends User {
    perms: Map<string, string>,
    givenName: string,
    surname: string
}


//===================================================================================
//========================== PROPERTY =======================================
export interface Identifiable {
    id: string;
}

export interface BasicProperty extends Identifiable {
    name: string;
    value: any;
}

export interface PropertyItem extends BasicProperty {
    category: string;
    displayName: string;
    editable: boolean;
    enabled: boolean;
    contextProperties?: BasicProperty[];
}

export interface BasicKVP {
    key: string;
    value: any;
}

//===================================================================================
//========================== API RESPONSE DATA ======================================
export interface ResponseData {
    payload: any;
    error: ErrorData;
}

export interface ErrorData {
    id: string;
    code: string;
    severity: ErrorSeverityValue;
    message: string;
}



//===================================================================================
//========================== OTHER DATA ======================================


export interface StorageCollateralInfo{
    id: string,
    name: string,
    projectId: string,
    interfaceId: string,
    size: string,
    mediaType: string
}


export interface EditorNotesData { 
    blocks: any[], 
    time: number, 
    version: string
}


export class StringBuilder {
    private lines: string[] = [];

    append(line: string = ""): void {
        this.lines.push(line);
    }

    appendLine(line: string = ""): void {
        this.lines.push(line);
        this.lines.push("\n");
    }

    toString(): string {
        return this.lines.join("");
    }
}


export interface StatusIndicatorItem {
    id: string, 
    index : number,
    title: string,
    description: string,
    lastUpdatedOn: Date,
    isOk: boolean,
    isProcessing: boolean,
    message: string
}


export interface QuickStatus<T> {
    isSuccessful: boolean,
    message: string, 
    data?: T
}

