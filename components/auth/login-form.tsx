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
    <div className={cn("space-y-5", className)}>
      {/* OAuth Button */}
      <OAuthGoogleButton
        onClick={onGoogleSignIn}
        isLoading={isGoogleLoading}
        disabled={isLoading}
        label="Đăng nhập với Google"
      />

      {/* Divider */}
      <div className="relative flex items-center justify-center my-2">
        <div className="w-full border-t border-border/70" />
        <span className="absolute bg-card px-3 text-xs uppercase font-medium tracking-wider text-muted-foreground">
          hoặc email
        </span>
      </div>

      {/* Global Server Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive dark:bg-destructive/20"
        >
          <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email Field */}
        <div className="space-y-1.5">
          <Label
            htmlFor="login-email"
            className="text-xs font-semibold text-foreground"
          >
            Địa chỉ Email
          </Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <MailIcon className="size-4" />
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
              className="pl-9.5 h-10.5 text-sm"
            />
          </div>
          {clientErrors.email && (
            <p className="text-xs text-destructive font-medium mt-1">
              {clientErrors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="login-password"
              className="text-xs font-semibold text-foreground"
            >
              Mật khẩu
            </Label>
            {onForgotPasswordClick ? (
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-xs text-primary hover:underline font-medium transition-colors"
              >
                Quên mật khẩu?
              </button>
            ) : (
              <a
                href="#forgot-password"
                className="text-xs text-primary hover:underline font-medium transition-colors"
              >
                Quên mật khẩu?
              </a>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <LockIcon className="size-4" />
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
              className="pl-9.5 pr-10 h-10.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          </div>
          {clientErrors.password && (
            <p className="text-xs text-destructive font-medium mt-1">
              {clientErrors.password}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          size="default"
          disabled={isLoading || isGoogleLoading}
          className="w-full h-11 mt-2 rounded-lg text-sm font-semibold justify-center gap-2 shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2Icon className="size-4.5 animate-spin" />
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <>
              <span>Đăng nhập</span>
              <ArrowRightIcon className="size-4" />
            </>
          )}
        </Button>
      </form>

      {/* Switch to SignUp */}
      <div className="pt-3 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        {onSignUpClick ? (
          <button
            type="button"
            onClick={onSignUpClick}
            className="text-primary font-semibold hover:underline transition-colors"
          >
            Đăng ký ngay
          </button>
        ) : (
          <a
            href="/signup"
            className="text-primary font-semibold hover:underline transition-colors"
          >
            Đăng ký ngay
          </a>
        )}
      </div>
    </div>
  );
}
