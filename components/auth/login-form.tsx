"use client";

import * as React from "react";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  Loader2Icon,
  ArrowRightIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OAuthGoogleButton } from "./oauth-google-button";
import type { LoginFormData } from "./types";
import { cn } from "@/lib/utils";

export interface LoginFormProps {
  onSubmit?: (data: LoginFormData) => void | Promise<void>;
  onGoogleSignIn?: () => void | Promise<void>;
  showGoogleOAuth?: boolean;
  isLoading?: boolean;
  isGoogleLoading?: boolean;
  errorMessage?: string | null;
  initialEmail?: string;
  onForgotPasswordClick?: () => void;
  onSignUpClick?: () => void;
  className?: string;
}

export function LoginForm({
  onSubmit,
  onGoogleSignIn,
  showGoogleOAuth = false,
  isLoading = false,
  isGoogleLoading = false,
  errorMessage = null,
  initialEmail = "",
  onForgotPasswordClick,
  onSignUpClick,
  className,
}: LoginFormProps) {
  const [email, setEmail] = React.useState(initialEmail);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [clientErrors, setClientErrors] = React.useState<{
    email?: string;
    password?: string;
  }>({});

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Địa chỉ email không đúng định dạng.";
    }

    if (!password) {
      errors.password = "Vui lòng nhập mật khẩu.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    if (onSubmit) {
      onSubmit({ email: email.trim(), password });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* OAuth Button & Divider (Only if enabled) */}
      {showGoogleOAuth && (
        <>
          <OAuthGoogleButton
            onClick={onGoogleSignIn}
            isLoading={isGoogleLoading}
            disabled={isLoading}
            label="Đăng nhập với Google"
          />

          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-border/60" />
            <span className="absolute bg-card px-2 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              hoặc email
            </span>
          </div>
        </>
      )}

      {/* Global Server Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {/* Email Field */}
        <div className="space-y-1">
          <Label htmlFor="login-email">Địa chỉ Email</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted-foreground">
              <MailIcon className="size-3.5" />
            </div>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="example@ielts-prep.vn"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (clientErrors.email) {
                  setClientErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              disabled={isLoading || isGoogleLoading}
              aria-invalid={Boolean(clientErrors.email)}
              className="pl-8"
            />
          </div>
          {clientErrors.email && (
            <p className="text-[0.7rem] text-destructive font-medium">
              {clientErrors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Mật khẩu</Label>
            {onForgotPasswordClick ? (
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-[0.7rem] text-primary hover:underline font-medium transition-colors"
              >
                Quên mật khẩu?
              </button>
            ) : (
              <a
                href="#forgot-password"
                className="text-[0.7rem] text-primary hover:underline font-medium transition-colors"
              >
                Quên mật khẩu?
              </a>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted-foreground">
              <LockIcon className="size-3.5" />
            </div>
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (clientErrors.password) {
                  setClientErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              disabled={isLoading || isGoogleLoading}
              aria-invalid={Boolean(clientErrors.password)}
              className="pl-8 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOffIcon className="size-3.5" />
              ) : (
                <EyeIcon className="size-3.5" />
              )}
            </button>
          </div>
          {clientErrors.password && (
            <p className="text-[0.7rem] text-destructive font-medium">
              {clientErrors.password}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          size="default"
          disabled={isLoading || isGoogleLoading}
          className="w-full h-9 mt-2 font-medium justify-center gap-1.5"
        >
          {isLoading ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <>
              <span>Đăng nhập</span>
              <ArrowRightIcon className="size-3.5" />
            </>
          )}
        </Button>
      </form>

      {/* Switch to SignUp */}
      <div className="pt-2 text-center text-xs text-muted-foreground">
        Chưa có tài khoản?{" "}
        {onSignUpClick ? (
          <button
            type="button"
            onClick={onSignUpClick}
            className="text-primary font-semibold hover:underline"
          >
            Đăng ký ngay
          </button>
        ) : (
          <a
            href="/signup"
            className="text-primary font-semibold hover:underline"
          >
            Đăng ký ngay
          </a>
        )}
      </div>
    </div>
  );
}
