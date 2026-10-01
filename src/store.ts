import { StoreValue } from "./types";

/**
 * In-Memory Key-Value Store with TTL, Lists, Hashes, and Counters
 */
export class MemoryStore {
  // Key -> String value with TTL
  private strings: Map<string, StoreValue> = new Map();

  // Key -> Array of strings for Redis Lists
  private lists: Map<string, string[]> = new Map();

  // Key -> Map<field, value> for Redis Hashes
  private hashes: Map<string, Map<string, string>> = new Map();

  // ==========================================
  // 1. Strings & Basic Keys
  // ==========================================

  set(key: string, value: string, ttlMs?: number): void {
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
    this.strings.set(key, { value, expiresAt });
  }

  get(key: string): string | null {
    const item = this.strings.get(key);
    if (!item) return null;

    if (item.expiresAt !== undefined && Date.now() > item.expiresAt) {
      this.strings.delete(key);
      return null;
    }

    return item.value;
  }

  del(keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      let deleted = false;
      if (this.strings.delete(key)) deleted = true;
      if (this.lists.delete(key)) deleted = true;
      if (this.hashes.delete(key)) deleted = true;
      if (deleted) count++;
    }
    return count;
  }

  exists(keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.get(key) !== null || this.lists.has(key) || this.hashes.has(key)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns remaining TTL in seconds:
   * -2 if key does not exist / expired
   * -1 if key exists but has no TTL
   * >= 0 remaining seconds
   */
  ttl(key: string): number {
    const item = this.strings.get(key);
    if (!item) return -2;

    if (item.expiresAt !== undefined) {
      const remainingMs = item.expiresAt - Date.now();
      if (remainingMs <= 0) {
        this.strings.delete(key);
        return -2;
      }
      return Math.ceil(remainingMs / 1000);
    }

    return -1;
  }

  incr(key: string, delta: number = 1): number | null {
    const currentStr = this.get(key);
    let currentVal = 0;
    if (currentStr !== null) {
      const parsed = parseInt(currentStr, 10);
      if (isNaN(parsed)) return null; // value is not an integer
      currentVal = parsed;
    }

    const newVal = currentVal + delta;
    const existing = this.strings.get(key);
    this.strings.set(key, {
      value: newVal.toString(),
      expiresAt: existing?.expiresAt,
    });
    return newVal;
  }

  // ==========================================
  // 2. Redis Lists (LPUSH, RPUSH, LPOP, RPOP, LRANGE, LLEN)
  // ==========================================

  lpush(key: string, ...values: string[]): number {
    const list = this.lists.get(key) || [];
    for (const val of values) {
      list.unshift(val); // Insert at head
    }
    this.lists.set(key, list);
    return list.length;
  }

  rpush(key: string, ...values: string[]): number {
    const list = this.lists.get(key) || [];
    for (const val of values) {
      list.push(val); // Insert at tail
    }
    this.lists.set(key, list);
    return list.length;
  }

  lpop(key: string): string | null {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    const val = list.shift()!;
    if (list.length === 0) this.lists.delete(key);
    return val;
  }

  rpop(key: string): string | null {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    const val = list.pop()!;
    if (list.length === 0) this.lists.delete(key);
    return val;
  }

  lrange(key: string, start: number, stop: number): string[] {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return [];

    const len = list.length;
    let s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
    let e = stop < 0 ? Math.max(len + stop, 0) : Math.min(stop, len - 1);

    if (s > e || s >= len) return [];
    return list.slice(s, e + 1);
  }

  llen(key: string): number {
    const list = this.lists.get(key);
    return list ? list.length : 0;
  }

  // ==========================================
  // 3. Redis Hashes (HSET, HGET, HGETALL, HDEL)
  // ==========================================

  hset(key: string, fieldValues: [string, string][]): number {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map<string, string>();
      this.hashes.set(key, hash);
    }

    let addedCount = 0;
    for (const [field, val] of fieldValues) {
      if (!hash.has(field)) addedCount++;
      hash.set(field, val);
    }
    return addedCount;
  }

  hget(key: string, field: string): string | null {
    const hash = this.hashes.get(key);
    if (!hash) return null;
    return hash.get(field) || null;
  }

  hgetall(key: string): [string, string][] {
    const hash = this.hashes.get(key);
    if (!hash) return [];
    return Array.from(hash.entries());
  }

  hdel(key: string, fields: string[]): number {
    const hash = this.hashes.get(key);
    if (!hash) return 0;

    let count = 0;
    for (const field of fields) {
      if (hash.delete(field)) count++;
    }
    if (hash.size === 0) this.hashes.delete(key);
    return count;
  }

  flush(): void {
    this.strings.clear();
    this.lists.clear();
    this.hashes.clear();
  }
}

export const globalStore = new MemoryStore();
