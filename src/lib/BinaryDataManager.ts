import { BinaryDataFile } from "./BinaryDataFile";

export class BinaryDataManager {
    private _binaryDataFiles: BinaryDataFile[];
    private _binaryDataByFileId: Record<string, BinaryDataFile>;

    constructor() {
        this._binaryDataFiles = [];
        this._binaryDataByFileId = {};
    }

    get binaryDataFiles(): BinaryDataFile[] {
        return this._binaryDataFiles;
    }

    public addBinaryDataFile(file: BinaryDataFile) {
        this._binaryDataFiles.push(file);
        this._binaryDataByFileId[file.binaryDataId] = file;
    }

    public searchBinaryDataByFileName(searchTerm: string): BinaryDataFile[] {
        return this._binaryDataFiles.filter(file => file.fileName.includes(searchTerm));
    }

    public getPassFiles(passId: string, start: Date, end: Date): BinaryDataFile[] {
        const ids = new Set([...this._getBinaryFileIdsForPass(passId), ...this._getBinaryFileIdsInTimeRange(start, end)]);
        return Array.from(ids.values())
            .map(id => this._binaryDataByFileId[id])
            .sort((a, b) => a.compareTo(b));
    }

    private _getBinaryFileIdsInTimeRange(start: Date, end: Date): string[] {
        const result: string[] = []
        this._binaryDataFiles.forEach(file => {
            if (!file.isInTimeRange(start, end)) return;
            result.push(file.binaryDataId);
        });
        return result;
    }

    private _getBinaryFileIdsForPass(passId: string): string[] {
        const result: string[] = []
        this._binaryDataFiles.forEach(file => {
            if (!file.isPartOfPass(passId)) return;
            result.push(file.binaryDataId);
        });
        return result;
    }
}