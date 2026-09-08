import { z } from 'zod';
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const nameSchema = z.string().trim().min(1, 'Please enter a name.').max(100);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.').nullable();
export const boardCreateSchema = z.object({ id: z.string().uuid(), name: nameSchema, description: z.string().trim().max(1000).default('') });
export const boardEditSchema = z.object({ name: nameSchema, description: z.string().trim().max(1000), revision: z.number().int().nonnegative() });
export const taskFields = z.object({ title: z.string().trim().min(1, 'Enter a task title.').max(200), description: z.string().max(10000).default(''), columnId: idSchema, priority: z.enum(['none', 'low', 'medium', 'high']).default('none'), dueDate: dateSchema.default(null), assigneeId: idSchema.nullable().default(null) });
export const taskCreateSchema = taskFields.extend({ id: z.string().uuid() });
export const taskEditSchema = taskFields.extend({ revision: z.number().int().nonnegative() });
export const moveSchema = z.object({ action: z.literal('move'), columnId: idSchema, beforeId: idSchema.nullable(), revision: z.number().int().nonnegative(), boardRevision: z.number().int().nonnegative() });
export const columnSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: nameSchema, id: z.string().uuid(), revision: z.number().int() }),
  z.object({ action: z.literal('rename'), id: idSchema, name: nameSchema, revision: z.number().int() }),
  z.object({ action: z.literal('reorder'), ids: z.array(idSchema).max(20), revision: z.number().int() }),
  z.object({ action: z.literal('delete'), id: idSchema, destinationId: idSchema.nullable(), revision: z.number().int() }),
]);
