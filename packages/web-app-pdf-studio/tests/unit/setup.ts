type ComputedMap = Map<unknown, unknown> & {
  getOrInsertComputed?: (key: unknown, compute: (key: unknown) => unknown) => unknown
}

// PDF.js uses it (e.g. in its EventBus), browsers have it, Node doesn't yet.
;(Map.prototype as ComputedMap).getOrInsertComputed ??= function (this: ComputedMap, key, compute) {
  if (!this.has(key)) {
    this.set(key, compute(key))
  }
  return this.get(key)
}
