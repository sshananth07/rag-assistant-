import { z } from 'zod'

export const querySchema = z.object({
    question: z.string().min(1, 'Question cannot be empty').max(1000, 'Question is too long'),
    paperIds: z.array(z.string()).min(1).max(5).optional(),
    socratic: z.boolean().optional().default(false),
})

export const ingestSchema = z.object({
    file: z.instanceof(File, { message: 'Must be a valid file' }),
})