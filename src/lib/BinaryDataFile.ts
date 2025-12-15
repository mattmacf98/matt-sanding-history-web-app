import * as VIAM from "@viamrobotics/sdk";

export class BinaryDataFile {
    private binaryData: VIAM.dataApi.BinaryData;

    constructor(binaryData: VIAM.dataApi.BinaryData) {
        this.binaryData = binaryData;
    }

    get binaryDataId(): string {
        return this.binaryData.metadata?.binaryDataId || '';
    }

    get datasetIds(): string[] {
        return this.binaryData.metadata?.datasetIds || [];
    }

    get fileExtension(): string {
        return this.binaryData.metadata?.fileExt || '';
    }

    get fileName(): string {
        return this.binaryData.metadata?.fileName || '';
    }

    get timeRequested(): Date | undefined {
        return this.binaryData.metadata?.timeRequested?.toDate();
    }

    get uri(): string {
        return this.binaryData.metadata?.uri || '';
    }

    public isInTimeRange(start: Date, end: Date): boolean {
        const timeRequested = this.timeRequested;
        if (!timeRequested) return false;
        return timeRequested >= start && timeRequested <= end;
    }

    public isPartOfPass(passId: string): boolean {
        return this.fileName.split("/").filter((fileNamePart) => fileNamePart === passId).length > 0;
    }
}