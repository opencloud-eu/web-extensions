import { z } from 'zod'
import type maplibregl from 'maplibre-gl'

export const MapsConfigSchema = z.object({
  folderViewEnabled: z.boolean().optional(),
  mapStyle: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  tileLayerUrlTemplate: z.string().optional(),
  tileLayerAttribution: z.string().optional(),
  tileLayerGlyphs: z.string().optional(),
  tileLayerOptions: z
    .object({
      maxZoom: z.number().default(19),
      attribution: z
        .string()
        .optional()
        .meta({ deprecated: true, description: 'Use `tileLayerAttribution` instead.' })
    })
    .passthrough()
    .and(z.custom<Partial<Omit<maplibregl.MapOptions, 'container' | 'style'>>>())
    .optional()
})

export type MapsConfig = z.infer<typeof MapsConfigSchema>
