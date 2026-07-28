import { z } from "zod";

export const academicLevels = [
  { value: "foundation", label: "Foundation" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "doctoral", label: "Doctoral" },
] as const;

export const citationStyles = [
  { value: "APA7", label: "APA 7th" },
  { value: "MLA", label: "MLA" },
  { value: "Chicago", label: "Chicago" },
  { value: "Harvard", label: "Harvard" },
] as const;

export const taskDefinitionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Please describe your research question or task.")
    .max(2000, "Research question must be under 2000 characters."),
  academicLevel: z.enum([
    "foundation",
    "undergraduate",
    "postgraduate",
    "doctoral",
  ]),
  citationStyle: z.enum(["APA7", "MLA", "Chicago", "Harvard"]),
});

export type TaskDefinitionFormValues = z.infer<typeof taskDefinitionSchema>;

export const writingProfileSchema = z.object({
  vocabulary: z.number().min(0).max(100),
  mechanics: z.number().min(0).max(100),
  organization: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

export const taskBreakdownRequestSchema = taskDefinitionSchema.extend({
  writingProfile: writingProfileSchema,
});

export type TaskBreakdownRequestValues = z.infer<typeof taskBreakdownRequestSchema>;
