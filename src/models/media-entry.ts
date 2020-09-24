export enum MediaType {
    Video,
    Images,
    UnencryptedVideo
}

export interface MediaEntry {
    id: string;
    title: string;
    description: string;
    manifest: string[];
    userName: string;
    identityAddress: string;
    keywords?: string[] | null;
    createdDateUTC: Date;
    lastUpdatedUTC: Date;
    mediaType?: MediaType;
    previewImageName?: string;
}