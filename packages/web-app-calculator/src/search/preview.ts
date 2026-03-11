import { SearchPreview, SearchResult } from '@opencloud-eu/web-pkg'
import { Component } from 'vue'
import { create, all } from 'mathjs/number'
import CalculatorPreview from './CalculatorPreview.vue'

const math = create(all)
math.import(
  {
    divide: function (a: number, b: number) {
      if (b === 0) {
        throw new Error('Division by zero')
      }
      return a / b
    }
  },
  { override: true }
)

export class Preview implements SearchPreview {
  public readonly component: Component

  constructor() {
    this.component = CalculatorPreview
  }

  public get available(): boolean {
    return true
  }

  public async search(term: string): Promise<SearchResult> {
    const match = term.match(/name:"\*(.+?)\*"/)
    if (!match) {
      return { totalResults: null, values: [] }
    }

    const rawInput = match[1]
    if (!rawInput.startsWith('=')) {
      return { totalResults: null, values: [] }
    }

    const expression = rawInput.slice(1)
    if (!expression) {
      return { totalResults: null, values: [] }
    }

    try {
      const result = math.evaluate(expression)
      return {
        totalResults: null,
        values: [
          {
            id: 'calculator-result',
            data: {
              id: 'calculator-result',
              name: String(result),
              icon: 'calculator'
            }
          }
        ]
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Division by zero') {
        return {
          totalResults: null,
          values: [
            {
              id: 'calculator-result',
              data: {
                id: 'calculator-result',
                name: 'division-by-zero',
                icon: 'calculator'
              }
            }
          ]
        }
      }
      return { totalResults: null, values: [] }
    }
  }
}
