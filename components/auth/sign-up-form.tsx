"use client";

import * as React from "react";
import {
  UserIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  CircleIcon,
  AlertCircleIcon,
  Loader2Icon,
  ArrowRightIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OAuthGoogleButton } from "./oauth-google-button";
import { evaluatePasswordStrength, type SignUpFormData } from "./types";
import { cn } from "@/lib/utils";

export interface SignUpFormProps {
  onSubmit?: (data: SignUpFormData) => void | Promise<void>;
  onGoogleSignIn?: () => void | Promise<void>;
  isLoading?: boolean;
  isGoogleLoading?: boolean;
  errorMessage?: string | null;
  onLoginClick?: () => void;
  className?: string;
}

export function SignUpForm({
  onSubmit,
  onGoogleSignIn,
  isLoading = false,
  isGoogleLoading = false,
  errorMessage = null,
  onLoginClick,
  className,
}: SignUpFormProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [clientErrors, setClientErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const passwordStrength = React.useMemo(
    () => evaluatePasswordStrength(password),
    [password]
  );

  const validate = (): boolean => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!name.trim()) {
      errors.name = "Vui lòng nhập họ và tên của bạn.";
    } else if (name.trim().length < 2) {
      errors.name = "Họ và tên phải có ít nhất 2 ký tự.";
    }

    if (!email.trim()) {
      errors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Địa chỉ email không đúng định dạng.";
    }

    if (!password) {
      errors.password = "Vui lòng nhập mật khẩu.";
    } else if (passwordStrength.score < 2) {
      errors.password = "Mật khẩu chưa đủ an toàn (tối thiểu mức Trung bình).";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Vui lòng xác nhận lại mật khẩu.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không trùng khớp.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    if (onSubmit) {
      onSubmit({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
    }
  };

  return (
    <div className={cn("space-y-5", className)}>
      {/* OAuth Button */}
      <OAuthGoogleButton
        onClick={onGoogleSignIn}
        isLoading={isGoogleLoading}
        disabled={isLoading}
        label="Đăng ký với Google"
      />

      {/* Divider */}
      <div className="relative flex items-center justify-center my-2">
        <div className="w-full border-t border-border/70" />
        <span className="absolute bg-card px-3 text-xs uppercase font-medium tracking-wider text-muted-foreground">
          hoặc điền thông tin
        </span>
      </div>

      {/* Server Error Banner */}
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label
            htmlFor="signup-name"
            className="text-xs font-semibold text-foreground"
          >
            Họ và tên
          </Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <UserIcon className="size-4" />
            </div>
            <Input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (clientErrors.name) {
                  setClientErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              disabled={isLoading || isGoogleLoading}
              aria-invalid={Boolean(clientErrors.name)}
              className="pl-9.5 h-10.5 text-sm"
            />
          </div>
          {clientErrors.name && (
            <p className="text-xs text-destructive font-medium mt-1">
              {clientErrors.name}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label
            htmlFor="signup-email"
            className="text-xs font-semibold text-foreground"
          >
            Địa chỉ Email
          </Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <MailIcon className="size-4" />
            </div>
            <Input
              id="signup-email"
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

        {/* Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="signup-password"
            className="text-xs font-semibold text-foreground"
          >
            Mật khẩu
          </Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <LockIcon className="size-4" />
            </div>
            <Input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
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

          {/* Password Strength Meter */}
          {password.length > 0 && (
            <div className="space-y-2 pt-1.5 pb-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Độ an toàn mật khẩu:
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    passwordStrength.score <= 1 && "text-destructive",
                    passwordStrength.score === 2 && "text-amber-500",
                    passwordStrength.score >= 3 && "text-emerald-500"
                  )}
                >
                  {passwordStrength.label}
                </span>
              </div>
              <div className="flex h-2 w-full gap-1.5 overflow-hidden rounded-full bg-muted/60">
                {[1, 2, 3, 4].map((step) => {
                  let barColor = "bg-muted";
                  if (passwordStrength.score >= step) {
                    if (passwordStrength.score <= 1)
                      barColor = "bg-destructive";
                    else if (passwordStrength.score === 2)
                      barColor = "bg-amber-500";
                    else barColor = "bg-emerald-500";
                  }
                  return (
                    <div
                      key={step}
                      className={cn(
                        "h-full flex-1 rounded-full transition-all duration-200",
                        barColor
                      )}
                    />
                  );
                })}
              </div>

              {/* Criteria Checklist */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-xs">
                <div
                  className={cn(
                    "flex items-center gap-1.5",
                    passwordStrength.criteria.minLength
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {passwordStrength.criteria.minLength ? (
                    <CheckCircle2Icon className="size-3.5 shrink-0" />
                  ) : (
                    <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span>Tối thiểu 8 ký tự</span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1.5",
                    passwordStrength.criteria.hasUppercase
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {passwordStrength.criteria.hasUppercase ? (
                    <CheckCircle2Icon className="size-3.5 shrink-0" />
                  ) : (
                    <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span>1 chữ in hoa (A-Z)</span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1.5",
                    passwordStrength.criteria.hasLowercase
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {passwordStrength.criteria.hasLowercase ? (
                    <CheckCircle2Icon className="size-3.5 shrink-0" />
                  ) : (
                    <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span>1 chữ thường (a-z)</span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1.5",
                    passwordStrength.criteria.hasNumberOrSpecial
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {passwordStrength.criteria.hasNumberOrSpecial ? (
                    <CheckCircle2Icon className="size-3.5 shrink-0" />
                  ) : (
                    <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span>Số / ký tự đặc biệt</span>
                </div>
              </div>
            </div>
          )}

          {clientErrors.password && (
            <p className="text-xs text-destructive font-medium mt-1">
              {clientErrors.password}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label
            htmlFor="signup-confirm-password"
            className="text-xs font-semibold text-foreground"
          >
            Xác nhận mật khẩu
          </Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <LockIcon className="size-4" />
            </div>
            <Input
              id="signup-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (clientErrors.confirmPassword) {
                  setClientErrors((prev) => ({
                    ...prev,
                    confirmPassword: undefined,
                  }));
                }
              }}
              disabled={isLoading || isGoogleLoading}
              aria-invalid={Boolean(clientErrors.confirmPassword)}
              className="pl-9.5 pr-10 h-10.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={
                showConfirmPassword
                  ? "Ẩn xác nhận mật khẩu"
                  : "Hiện xác nhận mật khẩu"
              }
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          </div>
          {clientErrors.confirmPassword && (
            <p className="text-xs text-destructive font-medium mt-1">
              {clientErrors.confirmPassword}
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
              <span>Đang tạo tài khoản...</span>
            </>
          ) : (
            <>
              <span>Tạo tài khoản</span>
              <ArrowRightIcon className="size-4" />
            </>
          )}
        </Button>
      </form>

      {/* Switch to Login */}
      <div className="pt-3 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        {onLoginClick ? (
          <button
            type="button"
            onClick={onLoginClick}
            className="text-primary font-semibold hover:underline transition-colors"
          >
            Đăng nhập ngay
          </button>
        ) : (
          <a
            href="/login"
            className="text-primary font-semibold hover:underline transition-colors"
          >
            Đăng nhập ngay
          </a>
        )}
      </div>
    </div>
  );
}
