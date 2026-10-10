type ComputedMap = Map<unknown, unknown> & {
  getOrInsertComputed?: (key: unknown, compute: (key: unknown) => unknown) => unknown
}

// PDF.js uses it, browsers have it, Node doesn't yet. Needed by PDF.js' own classes in tests,
// e.g. its EventBus.
export function polyfillGetOrInsertComputed() {
  const mapPrototype = Map.prototype as ComputedMap
  const hasGetOrInsertComputed = !!mapPrototype.getOrInsertComputed
  beforeAll(() => {
    mapPrototype.getOrInsertComputed ??= function (this: ComputedMap, key, compute) {
      if (!this.has(key)) {
        this.set(key, compute(key))
      }
      return this.get(key)
    }
  })
  afterAll(() => {
    if (!hasGetOrInsertComputed) {
      delete mapPrototype.getOrInsertComputed
    }
  })
}
