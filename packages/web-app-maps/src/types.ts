import { z } from 'zod'

export const MapsConfigSchema = z.object({
  folderViewEnabled: z.boolean().optional(),
  mapStyle: z.union([z.string(), z.record(z.string(), z.unknown())]).optional()
})

export type MapsConfig = z.infer<typeof MapsConfigSchema>
