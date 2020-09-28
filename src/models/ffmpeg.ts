import { MediaEntry } from "./media-entry";

export enum FFMpegInputType {
    PreviewImage,
    GetDimensions,
    Hls
}

export interface FFMpegFile {
    name: string;
    data: ArrayBuffer;
}

export interface FFMpegVideoDimension {
    width: number;
    height: number;
}

export interface FFMpegInput {
    file: any;
    fileData: ArrayBuffer;
    inputType: FFMpegInputType;
    output?: string;
    dimensions?: FFMpegVideoDimension | null | undefined;
    keyData?: ArrayBuffer;
    keyInfoData?: ArrayBuffer;
    ffmpeg?: any;
}

export interface FFMpegEncryptResult {
    mediaEntry?: MediaEntry;
    hlsFiles?: FFMpegFile[];
    errorMessage?: string
}
