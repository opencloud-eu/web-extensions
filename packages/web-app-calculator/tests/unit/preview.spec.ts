import { Preview } from '../../src/search/preview'
import { GenericSearchResultItem } from '@opencloud-eu/web-pkg'

describe('CalculatorPreview search', () => {
  let preview: Preview

  beforeEach(() => {
    preview = new Preview()
  })

  describe('expression evaluation', () => {
    it('evaluates simple addition', async () => {
      const result = await preview.search('name:"*=4+5*"')
      expect(result.values).toHaveLength(1)
      expect(result.values[0].data.name).toBe('9')
    })

    it('evaluates subtraction', async () => {
      const result = await preview.search('name:"*=10-3*"')
      expect(result.values[0].data.name).toBe('7')
    })

    it('evaluates multiplication', async () => {
      const result = await preview.search('name:"*=6*7*"')
      expect(result.values[0].data.name).toBe('42')
    })

    it('evaluates division', async () => {
      const result = await preview.search('name:"*=15/3*"')
      expect(result.values[0].data.name).toBe('5')
    })

    it('evaluates sqrt', async () => {
      const result = await preview.search('name:"*=sqrt(16)*"')
      expect(result.values[0].data.name).toBe('4')
    })

    it('evaluates complex expressions', async () => {
      const result = await preview.search('name:"*=(2+3)*4*"')
      expect(result.values[0].data.name).toBe('20')
    })
  })

  describe('result format', () => {
    it('returns calculator-result id', async () => {
      const result = await preview.search('name:"*=1+1*"')
      expect(result.values[0].id).toBe('calculator-result')
      expect(result.values[0].data.id).toBe('calculator-result')
    })

    it('returns calculator icon', async () => {
      const result = await preview.search('name:"*=1+1*"')
      expect((result.values[0].data as GenericSearchResultItem).icon).toBe('calculator')
    })

    it('returns null totalResults', async () => {
      const result = await preview.search('name:"*=1+1*"')
      expect(result.totalResults).toBeNull()
    })
  })

  describe('non-calculator input', () => {
    it('returns empty for terms without = prefix', async () => {
      const result = await preview.search('name:"*hello*"')
      expect(result.values).toHaveLength(0)
    })

    it('returns empty for invalid expressions', async () => {
      const result = await preview.search('name:"*=garbage*"')
      expect(result.values).toHaveLength(0)
    })

    it('returns error result for division by zero', async () => {
      const result = await preview.search('name:"*=1/0*"')
      expect(result.values).toHaveLength(1)
      expect(result.values[0].data.name).toBe('division-by-zero')
    })

    it('returns empty for bare = with no expression', async () => {
      const result = await preview.search('name:"*=*"')
      expect(result.values).toHaveLength(0)
    })

    it('returns empty when KQL format is missing', async () => {
      const result = await preview.search('random input')
      expect(result.values).toHaveLength(0)
    })
  })

  describe('KQL extraction', () => {
    it('extracts term from full-text search KQL', async () => {
      const result = await preview.search('(name:"*=2+3*" OR content:"=2+3") scope:12345')
      expect(result.values[0].data.name).toBe('5')
    })

    it('extracts term from KQL with scope', async () => {
      const result = await preview.search('name:"*=9/3*" scope:abc')
      expect(result.values[0].data.name).toBe('3')
    })
  })

  describe('availability', () => {
    it('is always available', () => {
      expect(preview.available).toBe(true)
    })
  })
})
