import { z } from "zod";

const tagName = z.string().trim().toLowerCase().min(1).max(50);
const tagColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #RRGGBB value.");

export const createTagSchema = z.object({ name: tagName, color: tagColor.optional() }).strict();

export const updateTagSchema = z
  .object({ name: tagName.optional(), color: tagColor.nullable().optional() })
  .strict()
  .refine(
    (input) => input.name !== undefined || input.color !== undefined,
    "Provide at least one tag field.",
  );

export const addApplicationTagsSchema = z
  .object({ tagIds: z.array(z.string().trim().min(1)).min(1).max(100) })
  .strict()
  .refine((input) => new Set(input.tagIds).size === input.tagIds.length, "Tag IDs must be unique.");

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type AddApplicationTagsInput = z.infer<typeof addApplicationTagsSchema>;
