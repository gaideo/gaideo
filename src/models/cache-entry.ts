
export interface CacheEntry {
    key: IDBValidKey;
    primaryKey: IDBValidKey;
    data: string;
    section: string;
    lastUpdated: Date;
    shareName?: string;
    isPublic?: boolean;
}

export interface CacheResults {
    cacheEntries: CacheEntry[];
    nextKey: IDBValidKey | null;
    nextPrimaryKey: IDBValidKey | null;
    allEntries?: CacheEntry[];
}