import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z.string().trim().max(100, "Name must be under 100 characters.").optional(),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be under 72 characters."),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
