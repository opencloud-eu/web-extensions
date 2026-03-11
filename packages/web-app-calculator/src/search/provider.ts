import { SearchList, SearchPreview, SearchProvider } from '@opencloud-eu/web-pkg'
import { Preview } from './preview'

export class CalculatorProvider implements SearchProvider {
  public readonly id: string
  public readonly displayName: string
  public readonly previewSearch: SearchPreview
  public readonly listSearch: SearchList | undefined = undefined

  constructor($gettext: (msg: string) => string) {
    this.id = 'calculator'
    this.displayName = $gettext('Calculator')
    this.previewSearch = new Preview()
  }

  public get available(): boolean {
    return true
  }
}
