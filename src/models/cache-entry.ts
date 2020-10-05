
export interface CacheEntry {
    key: IDBValidKey;
    primaryKey: IDBValidKey;
    data: string;
    section: string;
    lastUpdated: Date;
    shareName?: string;
    groups?: string[];
}

export interface CacheResults {
    cacheEntries: CacheEntry[];
    nextKey: IDBValidKey | null;
    nextPrimaryKey: IDBValidKey | null;
    allEntries?: CacheEntry[];
}