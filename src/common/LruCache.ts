export interface CacheEntry<V> {
  value: V;
  expireAt?: number; // optional TTL
}

export class LruCache<V> {
  private map = new Map<string, CacheEntry<V>>();

  constructor(
    private readonly maxSize: number = 1000,
    private readonly ttlMs?: number,
  ) {}

  private isExpired(entry: CacheEntry<V>): boolean {
    return entry.expireAt !== undefined && entry.expireAt < Date.now();
  }

  get(key: string): V | null {
    const entry = this.map.get(key);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.map.delete(key);
      return null;
    }

    // LRU operation: promote this key's order
    this.map.delete(key);
    this.map.set(key, entry);

    return entry.value;
  }

  set(key: string, value: V): void {
    let expireAt: number | undefined = undefined;
    if (this.ttlMs) {
      expireAt = Date.now() + this.ttlMs;
    }

    if (this.map.has(key)) {
      // Overwrite and promote order
      this.map.delete(key);
    }

    this.map.set(key, { value, expireAt });

    // Evict oldest entry when capacity exceeded
    if (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value as string;
      this.map.delete(oldestKey);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
