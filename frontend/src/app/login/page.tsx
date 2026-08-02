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
import { loginSchema, type LoginFormValues } from "@/features/auth/schema";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
      router.push("/profile");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-8">
      <StepHeader title="Welcome Back." description="Log in to continue your writing." />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="flex flex-col gap-6">
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
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />

          {formError && (
            <p role="alert" className="text-sm font-medium text-red-500">
              {formError}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            {isSubmitting ? "Logging in..." : "Log In"}
          </Button>

          <p className="text-center text-sm text-foreground/60">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              Sign up
            </Link>
          </p>
        </Card>
      </form>
    </div>
  );
}
