import { mock } from 'vitest-mock-extended'
import { getPublicLinkToken, getPublicPastebinUrl } from '../../src/utils'

type PastebinRouter = Parameters<typeof getPublicPastebinUrl>[0]
type ResolvedRoute = ReturnType<PastebinRouter['resolve']>

describe('getPublicLinkToken', () => {
  it.each([
    { webUrl: 'https://cloud.example.com/s/abc123', expected: 'abc123' },
    { webUrl: 'https://cloud.example.com/s/abc123/', expected: 'abc123' },
    { webUrl: 'https://cloud.example.com/s/abc123?foo=bar', expected: 'abc123' }
  ])('extracts the token from $webUrl', ({ webUrl, expected }) => {
    expect(getPublicLinkToken(webUrl)).toBe(expected)
  })
})

describe('getPublicPastebinUrl', () => {
  beforeAll(() => {
    const base = document.createElement('base')
    base.href = '/'
    document.head.appendChild(base)
  })
  afterAll(() => {
    document.querySelectorAll('base').forEach((e) => e.remove())
  })

  it('links to the pastebin view of the public link instead of the raw share link', () => {
    const router = mock<PastebinRouter>()
    router.resolve.mockImplementation((to) => {
      if (typeof to === 'string') {
        return mock<ResolvedRoute>({ href: to })
      }
      return mock<ResolvedRoute>({
        fullPath: `/pastebin/view/${'params' in to && to.params.driveAliasAndItem}`
      })
    })

    expect(getPublicPastebinUrl(router, 'https://cloud.example.com/s/abc123')).toBe(
      `${window.location.origin}/pastebin/view/public/abc123`
    )
    expect(router.resolve).toHaveBeenCalledWith({
      name: 'pastebin-view',
      params: { driveAliasAndItem: 'public/abc123' }
    })
  })
})
