import { z } from "zod";

export const noteContentSchema = z.string().trim().min(1).max(5000);
export const createNoteSchema = z.object({ content: noteContentSchema }).strict();
export const updateNoteSchema = z.object({ content: noteContentSchema }).strict();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
