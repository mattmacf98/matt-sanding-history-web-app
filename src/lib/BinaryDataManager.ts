import { BinaryDataFile } from "./BinaryDataFile";

export class BinaryDataManager {
    private _dataIdToFile: Record<string, BinaryDataFile>;
    private _fileNameToFile: Record<string, BinaryDataFile>;
    private _binaryDataFiles: BinaryDataFile[];

    constructor() {
        this._dataIdToFile = {};
        this._fileNameToFile = {};
        this._binaryDataFiles = [];
    }

    get binaryDataFiles(): BinaryDataFile[] {
        return this._binaryDataFiles;
    }

    public addBinaryDataFile(file: BinaryDataFile) {
        this._dataIdToFile[file.binaryDataId] = file;
        this._fileNameToFile[file.fileName] = file;
        this._binaryDataFiles.push(file);
    }

    public getBinaryDataFileById(binaryDataId: string): BinaryDataFile | undefined {
        return this._dataIdToFile[binaryDataId];
    }

    public getBinaryDataFileByFileName(fileName: string): BinaryDataFile | undefined {
        return this._fileNameToFile[fileName];
    }

    public searchBinaryDataByFileName(searchTerm: string): BinaryDataFile[] {
        return Object.values(this._fileNameToFile).filter(file => file.fileName.includes(searchTerm));
    }

    public getBinaryFileIdsInTimeRange(start: Date, end: Date): string[] {
        const result: string[] = []
        Object.values(this._dataIdToFile).forEach(file => {
            if (!file.isInTimeRange(start, end)) return;
            result.push(file.binaryDataId);
        });
        return result;
    }

    public getBinaryFileIdsForPass(passId: string): string[] {
        const result: string[] = []
        Object.values(this._dataIdToFile).forEach(file => {
            if (!file.isPartOfPass(passId)) return;
            result.push(file.binaryDataId);
        });
        return result;
    }
}