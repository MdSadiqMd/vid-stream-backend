interface UploadFields {
    [key: string]: any;
}

interface UploadedFile {
    filepath: string;
    [key: string]: any;
}

interface UploadResult {
    fields: UploadFields;
    files: {
        file: UploadedFile | UploadedFile[];
    };
}

export { UploadFields, UploadedFile, UploadResult };