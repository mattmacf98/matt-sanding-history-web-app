import * as VIAM from "@viamrobotics/sdk";

export class BinaryDataFile {
    private _binaryData: VIAM.dataApi.BinaryData;

    constructor(binaryData: VIAM.dataApi.BinaryData) {
        this._binaryData = binaryData;
    }

    get binaryDataId(): string {
        return this._binaryData.metadata?.binaryDataId || '';
    }

    get binaryData(): VIAM.dataApi.BinaryData {
        return this._binaryData;
    }

    get datasetIds(): string[] {
        return this._binaryData.metadata?.datasetIds || [];
    }

    get fileExtension(): string {
        return this._binaryData.metadata?.fileExt || '';
    }

    get fileName(): string {
        return this._binaryData.metadata?.fileName || '';
    }

    get timeRequested(): Date | undefined {
        return this._binaryData.metadata?.timeRequested?.toDate();
    }

    get uri(): string {
        return this._binaryData.metadata?.uri || '';
    }

    public isInTimeRange(start: Date, end: Date): boolean {
        const timeRequested = this.timeRequested;
        if (!timeRequested) return false;
        return timeRequested >= start && timeRequested <= end;
    }

    public isPartOfPass(passId: string): boolean {
        return this.fileName.split("/").filter((fileNamePart) => fileNamePart === passId).length > 0;
    }
<<<<<<< HEAD

    public compareTo(other: BinaryDataFile): number {
        return this.timeRequested!.getTime() - other.timeRequested!.getTime();
    }
=======
>>>>>>> parent of 5f9d18e (Revert "App 14532 show wiew snapshot button")
}