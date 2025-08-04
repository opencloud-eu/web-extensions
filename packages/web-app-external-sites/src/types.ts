import { z } from 'zod'

export const ExternalSiteSchema = z.object({
  name: z.string(),
  target: z.enum(['embedded', 'external']),
  url: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
  priority: z.number().optional(),
  description: z.string().optional()
})

export type ExternalSite = z.infer<typeof ExternalSiteSchema>

export const isExternalSite = (item: ExternalSiteOrSiteGroup): item is ExternalSite => {
  return (item as ExternalSiteGroup).sites === undefined
}

export const ExternalSiteGroupSchema = z.object({
  name: z.string().optional(),
  sites: z.array(ExternalSiteSchema)
})

export type ExternalSiteGroup = z.infer<typeof ExternalSiteGroupSchema>

export const ExternalSiteOrSiteGroupSchema = z.union([ExternalSiteSchema, ExternalSiteGroupSchema])

export type ExternalSiteOrSiteGroup = z.infer<typeof ExternalSiteOrSiteGroupSchema>

export const isExternalSiteGroup = (item: ExternalSiteOrSiteGroup): item is ExternalSiteGroup => {
  return (item as ExternalSiteGroup).sites !== undefined
}

export const ExternalSitesConfigSchema = z.object({
  dashboard: z
    .object({
      enabled: z.boolean().default(true),
      title: z.string().optional()
    })
    .default({
      enabled: true
    }),
  sites: z.array(ExternalSiteOrSiteGroupSchema)
})
