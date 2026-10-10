import { getDocument, GlobalWorkerOptions, PasswordResponses } from 'pdfjs-dist'
import { loadPdfDocument, pdfjsAssetUrls } from '../../../src/helpers/pdfjs'

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({ destroy: vi.fn(), onPassword: null })),
  GlobalWorkerOptions: { workerSrc: '' },
  PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 }
}))

describe('pdfjs helpers', () => {
  describe('loadPdfDocument', () => {
    it('tries a known password first', () => {
      loadPdfDocument(new ArrayBuffer(1), { password: 'secret' })
      expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({ password: 'secret' }))
    })

    it('configures the worker and the asset urls from our own dist', () => {
      loadPdfDocument(new ArrayBuffer(4))
      expect(GlobalWorkerOptions.workerSrc).toBe(pdfjsAssetUrls.worker)
      expect(getDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          cMapUrl: pdfjsAssetUrls.cMaps,
          standardFontDataUrl: pdfjsAssetUrls.standardFonts,
          wasmUrl: pdfjsAssetUrls.wasm,
          iccUrl: pdfjsAssetUrls.iccs
        })
      )
    })
    it.each([
      [PasswordResponses.NEED_PASSWORD, false],
      [PasswordResponses.INCORRECT_PASSWORD, true]
    ])('requests a password (reason %s, retry: %s)', (reason, isRetry) => {
      const onPasswordRequest = vi.fn()
      const task = loadPdfDocument(new ArrayBuffer(1), { onPasswordRequest })
      const updatePassword = vi.fn()
      task.onPassword(updatePassword, reason)

      const request = onPasswordRequest.mock.calls[0][0]
      expect(request.isRetry).toBe(isRetry)
      request.submit('secret')
      expect(updatePassword).toHaveBeenCalledWith('secret')
      request.cancel()
      expect(task.destroy).toHaveBeenCalled()
    })
  })
})
