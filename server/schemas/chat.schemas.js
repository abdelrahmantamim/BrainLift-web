import { z } from 'zod';

export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(50000),
  conversationId: z.string().optional().nullable(),
  fileContext: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    files: z.array(z.any()).optional(),
    processedFiles: z.array(z.any()).optional(),
    fileCount: z.number().optional(),
  }).optional().nullable(),
  aiResponseStyle: z.enum(['simple', 'detailed', 'concise']).optional(),
}).passthrough();

export const processFilesSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1, 'At least one file ID is required'),
});
