import { flushPromises } from '@vue/test-utils'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfSignatureStorage } from '../../../src/composables/usePdfSignatureStorage'

// The real compression needs browser streams, a JSON round trip keeps the contract.
vi.mock('pdfjs-dist', () => {
  let count = 0
  return {
    getUuid: () => `uuid-${++count}`,
    SignatureExtractor: {
      compressSignature: vi.fn((data: object) => Promise.resolve(JSON.stringify(data))),
      decompressSignature: vi.fn((data: string) => Promise.resolve(JSON.parse(data)))
    }
  }
})

const STORAGE_KEY = 'pdfjs.signature'
const data = { newCurves: [[1, 2, 3, 4]], areContours: false, thickness: 2, width: 100, height: 50 }

function setup() {
  let storage: ReturnType<typeof usePdfSignatureStorage>
  getComposableWrapper(() => {
    storage = usePdfSignatureStorage()
  })
  return storage
}

describe('usePdfSignatureStorage', () => {
  beforeEach(() => localStorage.clear())

  it('saves signatures in the browser like the PDF.js viewer and lists them', async () => {
    const storage = setup()
    const uuid = await storage.save(data, 'Jane Doe')
    await flushPromises()
    expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)))).toEqual([uuid])
    expect(storage.signatures.value).toEqual([
      {
        uuid,
        description: 'Jane Doe',
        areContours: false,
        lines: { curves: [{ points: [1, 2, 3, 4] }], thickness: 2, width: 100, height: 50 }
      }
    ])
  })

  it('keeps up to five, like the PDF.js viewer', async () => {
    const storage = setup()
    for (let i = 0; i < 5; i++) {
      expect(await storage.save(data, `Signature ${i}`)).toBeTruthy()
      await flushPromises()
    }
    expect(storage.isFull.value).toBe(true)
    expect(await storage.save(data, 'Too many')).toBeNull()
  })

  // Other apps of the same origin may have stored anything there.
  it('skips entries that are no signatures', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ broken: null, number: 1 }))
    const storage = setup()
    const uuid = await storage.save(data, 'Jane Doe')
    await flushPromises()
    expect(storage.signatures.value.map((s) => s.uuid)).toEqual([uuid])
  })

  it('counts only signatures towards the limit', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5 }))
    const storage = setup()
    await flushPromises()
    expect(storage.isFull.value).toBe(false)
    expect(await storage.save(data, 'Jane Doe')).toBeTruthy()
  })

  it('reports nothing saved when the storage cannot be written, e.g. when full', async () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = setup()
    expect(await storage.save(data, 'Jane Doe')).toBeNull()
    await flushPromises()
    expect(storage.signatures.value).toEqual([])
    setItem.mockRestore()
  })

  it('removes signatures', async () => {
    const storage = setup()
    const uuid = await storage.save(data, 'Jane Doe')
    storage.remove(uuid)
    await flushPromises()
    expect(storage.signatures.value).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({})
  })
})
