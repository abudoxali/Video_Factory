import { z } from 'zod';

export const CreateProjectInputSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'اسم المشروع يجب أن يكون على الأقل حرفين' })
    .max(100, { message: 'اسم المشروع طويل جداً (الحد الأقصى 100 حرف)' }),
  description: z
    .string()
    .max(500, { message: 'الوصف طويل جداً (الحد الأقصى 500 حرف)' })
    .optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
