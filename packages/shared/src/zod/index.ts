import { z } from "zod";

/** Reusable Zod primitives so every route handler validates ids/urls/slugs
 * the same way instead of each one re-deriving the rules. */
export const cuidSchema = z.string().cuid2();

export const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase letters, numbers, and hyphens only");

/** Public https URL only — used anywhere a user supplies a link that the
 * server itself does not fetch (fetch-time SSRF checks live separately in
 * packages/ai's webpage importer). */
export const publicUrlSchema = z
  .string()
  .url()
  .refine((v) => v.startsWith("https://") || v.startsWith("http://"), {
    message: "must be an http(s) URL",
  });

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color like #4F46E5");

export const nonEmptyString = z.string().trim().min(1);

export const isoDateSchema = z.string().datetime();
