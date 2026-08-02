"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/InputField";
import { StepHeader } from "@/components/task-definition/StepHeader";
import { useAuth } from "@/features/auth/useAuth";
import { signupSchema, type SignupFormValues } from "@/features/auth/schema";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await signup(values.email, values.password, values.displayName);
      router.push("/profile");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Signup failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-8">
      <StepHeader
        title="Create Your Account."
        description="Track your scores and past writings over time."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="flex flex-col gap-6">
          <InputField
            label="Name"
            autoComplete="name"
            error={errors.displayName?.message}
            {...register("displayName")}
          />
          <InputField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <InputField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            error={errors.password?.message}
            {...register("password")}
          />

          {formError && (
            <p role="alert" className="text-sm font-medium text-red-500">
              {formError}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </Button>

          <p className="text-center text-sm text-foreground/60">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </form>
    </div>
  );
}
