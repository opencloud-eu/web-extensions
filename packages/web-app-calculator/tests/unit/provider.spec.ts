import { CalculatorProvider } from '../../src/search/provider'

describe('CalculatorProvider', () => {
  const $gettext = (msg: string) => msg

  it('has id "calculator"', () => {
    const provider = new CalculatorProvider($gettext)
    expect(provider.id).toBe('calculator')
  })

  it('has displayName "Calculator"', () => {
    const provider = new CalculatorProvider($gettext)
    expect(provider.displayName).toBe('Calculator')
  })

  it('is always available', () => {
    const provider = new CalculatorProvider($gettext)
    expect(provider.available).toBe(true)
  })

  it('has previewSearch', () => {
    const provider = new CalculatorProvider($gettext)
    expect(provider.previewSearch).toBeDefined()
  })

  it('has no listSearch', () => {
    const provider = new CalculatorProvider($gettext)
    expect(provider.listSearch).toBeUndefined()
  })
})
