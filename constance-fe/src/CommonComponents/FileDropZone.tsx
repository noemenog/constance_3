import { Group, Text, rem } from '@mantine/core';
import { Dropzone, DropzoneProps, FileRejection, FileWithPath, IMAGE_MIME_TYPE, MIME_TYPES } from '@mantine/dropzone';
import { Theme } from '@mui/material/styles';
import { Clear, FileUploadOutlined, UploadFileOutlined } from '@mui/icons-material';
import { useState } from 'react';
import { useCStore } from '../DataModels/ZuStore';
import { UIMessageType } from '../DataModels/Constants';


interface FileDropZoneProps {
    height: number,
    acceptableMimeTypes: string[],
    multipleFilesAllowed: boolean,
    showAcceptedTypesInUI?: boolean,
    onSuccessfulDrop: (files: FileWithPath[]) => Promise<void>,
    onFileRejected: (fileRejections: FileRejection[]) => Promise<void>
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ height, acceptableMimeTypes, multipleFilesAllowed, onSuccessfulDrop, onFileRejected, showAcceptedTypesInUI = false }) => {

    const [loading, setLoading] = useState<boolean>(false);

    const displayQuickMessage = useCStore((state) => state.displayQuickMessage);

    function onDropped(files: FileWithPath[]): void {
        if (multipleFilesAllowed === false) {
            if (files.length > 1) {
                displayQuickMessage(UIMessageType.ERROR_MSG, "Error! Multiple file selection is not allowed here. Please select/upload a single file")
                return;
            }
        }

        if (onSuccessfulDrop) {
            setLoading(true)
            onSuccessfulDrop(files).finally(() => setLoading(false))
        }
    }

    function onRejected(fileRejections: FileRejection[]): void {
        if (onFileRejected) {
            setLoading(true)
            onFileRejected(fileRejections).finally(() => setLoading(false))
        }
    }

    let typesStr = (showAcceptedTypesInUI && acceptableMimeTypes && acceptableMimeTypes.length > 0)
        ? `. Acceptable types: ${acceptableMimeTypes.join(",")}`
        : ''



    return (
        <Dropzone
            onDrop={onDropped}
            onReject={onRejected}
            maxSize={1000 * 1024 ** 2}
            accept={acceptableMimeTypes}
            loading={loading}
        >
            <Group justify="center" gap="xl" mih={height} style={{ pointerEvents: 'none' }}>
                <Dropzone.Accept>
                    <FileUploadOutlined
                        style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
                    />
                </Dropzone.Accept>
                <Dropzone.Reject>
                    <Clear
                        style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
                    />
                </Dropzone.Reject>
                <Dropzone.Idle>
                    <UploadFileOutlined
                        style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}

                    />
                </Dropzone.Idle>

                <div>
                    <Text size="xl" inline>
                        {`Drag file here or click to select files`}
                    </Text>
                    <Text size="sm" c="dimmed" inline mt={7}>
                        {`Each file should not exceed 100mb${typesStr}`}
                    </Text>
                </div>
            </Group>
        </Dropzone>
    );
}

export default FileDropZone