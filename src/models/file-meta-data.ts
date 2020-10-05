
export interface FileMetaData {
    id: string;
    title: string;
    description: string;
    manifest: string[];
    userName: string;
    identityAddress: string;
    keywords?: string[] | null;
    createdDateUTC: Date;
    lastUpdatedUTC: Date;
    type: string;
}