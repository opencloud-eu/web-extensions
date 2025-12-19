import { Resource } from '@opencloud-eu/web-client'

export type TocNode = {
  resource: Resource
  children?: TocNode[]
  collapsed?: boolean
}
