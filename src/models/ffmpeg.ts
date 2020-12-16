import { MediaMetaData } from "./media-meta-data";

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
    isMusic?: boolean;
}

export interface FFMpegEncryptResult {
    metaData?: MediaMetaData;
    hlsFiles?: FFMpegFile[];
    errorMessage?: string
}
