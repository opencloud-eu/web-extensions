import { ref, nextTick } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@opencloud-eu/web-client'
import { useMapPins } from '../../src/composables/useMapPins'

vi.mock('maplibre-gl', () => {
  class Marker {
    setLngLat = vi.fn().mockReturnThis()
    addTo = vi.fn().mockReturnThis()
    remove = vi.fn()
  }

  class LngLatBounds {
    extend = vi.fn()
  }

  return {
    default: { Marker, LngLatBounds }
  }
})

function createResource(lat: number, lng: number): Resource {
  return mock<Resource>({ location: { latitude: lat, longitude: lng } })
}

function createMap() {
  return {
    resize: vi.fn(),
    fitBounds: vi.fn(),
    flyTo: vi.fn()
  } as any
}

describe('useMapPins', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls fitBounds on initial setView', () => {
    const resources = ref([createResource(48.0, 11.0)])
    const mapObject = ref(createMap())

    const { setView } = useMapPins(resources, mapObject)
    setView()

    expect(mapObject.value.fitBounds).toHaveBeenCalledOnce()
  })

  it('pans to new location via flyTo when coordinates change but pin count stays the same', async () => {
    const resources = ref([createResource(48.0, 11.0)])
    const mapObject = ref(createMap())

    const { setView } = useMapPins(resources, mapObject)
    setView()

    mapObject.value.fitBounds.mockClear()

    // Switch to a different picture with different coordinates (same pin count)
    resources.value = [createResource(52.0, 13.0)]
    await nextTick()
    await nextTick()

    expect(mapObject.value.flyTo).toHaveBeenCalledWith({
      center: [13.0, 52.0],
      animate: true
    })
    expect(mapObject.value.fitBounds).not.toHaveBeenCalled()
  })

  it('recenters map when pin count changes', async () => {
    const resources = ref([createResource(48.0, 11.0)])
    const mapObject = ref(createMap())

    const { setView } = useMapPins(resources, mapObject)
    setView()

    mapObject.value.fitBounds.mockClear()

    // Add a second pin
    resources.value = [createResource(48.0, 11.0), createResource(52.0, 13.0)]
    await nextTick()
    await nextTick()

    expect(mapObject.value.fitBounds).toHaveBeenCalled()
  })
})
