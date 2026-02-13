import { z } from 'zod'

export const MapsConfigSchema = z.object({
  folderViewEnabled: z.boolean().optional(),
  mapStyle: z.string().optional()
})

export type MapsConfig = z.infer<typeof MapsConfigSchema>
