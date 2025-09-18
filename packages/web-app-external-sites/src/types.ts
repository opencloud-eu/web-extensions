import { z } from 'zod'

export const VisibilityControlSchema = z
  .object({
    groups: z
      .object({
        any: z.array(z.string()).optional(),
        all: z.array(z.string()).optional(),
        none: z.array(z.string()).optional()
      })
      .optional()
  })
  .optional()

export type VisibilityControl = z.infer<typeof VisibilityControlSchema>

export const ExternalSiteSchema = z.object({
  name: z.string(),
  target: z.enum(['embedded', 'external']).optional().default('external'),
  url: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
  priority: z.number().optional(),
  description: z.string().optional(),
  visibility: VisibilityControlSchema.optional()
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

export const ExternalSiteDashboardSchema = z.object({
  path: z.string().optional(),

  name: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sites: z.array(ExternalSiteOrSiteGroupSchema),
  visibility: VisibilityControlSchema.optional()
})

export type ExternalSiteDashboard = z.infer<typeof ExternalSiteDashboardSchema>

export const ExternalSitesConfigSchema = z.object({
  defaultDashboard: z.string().optional(),
  dashboards: z.array(ExternalSiteDashboardSchema).default([]),
  sites: z.array(ExternalSiteSchema).default([])
})

export type ExternalSitesConfig = z.infer<typeof ExternalSitesConfigSchema>
