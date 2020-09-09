export interface VideoEntry {
    id: string;
    title: string;
    description: string;
    manifest: string[];
    previewImage: string;
    userName: string;
    identityAddress: string;
    keywords?: string[] | null;
    isPublic: boolean;
}