"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { signIn } from "@/lib/auth-client";
import type { LoginFormData } from "@/components/auth/types";
import { KeyRoundIcon, UserCheckIcon } from "lucide-react";

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirectTo") || "/auth/redirect";
  const urlError = searchParams.get("error");

  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    urlError
      ? "Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
      : null
  );
  const [activeEmail, setActiveEmail] = React.useState("");

  const handleEmailSignIn = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: redirectTo,
      });

      if (response.error) {
        let msg =
          "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.";
        if (
          response.error.status === 401 ||
          response.error.message?.includes("Invalid password") ||
          response.error.message?.includes("Invalid email")
        ) {
          msg = "Địa chỉ email hoặc mật khẩu không chính xác.";
        } else if (response.error.message?.includes("Rate limit")) {
          msg =
            "Quá nhiều lượt đăng nhập không thành công. Vui lòng thử lại sau ít phút.";
        } else if (response.error.message) {
          msg = response.error.message;
        }
        setErrorMessage(msg);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message ||
          "Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng thử lại sau."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      await signIn.social({
        provider: "google",
        callbackURL: redirectTo,
      });
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message ||
          "Đăng nhập với Google thất bại. Vui lòng thử lại."
      );
      setIsGoogleLoading(false);
    }
  };

  const handleQuickFill = (email: string) => {
    setActiveEmail(email);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <AuthCard
        title="Đăng nhập tài khoản"
        description="Chào mừng bạn quay lại! Đăng nhập để tiếp tục hành trình học tập."
      >
        <LoginForm
          key={activeEmail}
          initialEmail={activeEmail}
          onSubmit={handleEmailSignIn}
          onGoogleSignIn={handleGoogleSignIn}
          isLoading={isLoading}
          isGoogleLoading={isGoogleLoading}
          errorMessage={errorMessage}
          onForgotPasswordClick={() => {
            setErrorMessage(
              "Tính năng đặt lại mật khẩu đang được nâng cấp. Vui lòng liên hệ quản trị viên."
            );
          }}
          onSignUpClick={() => router.push("/signup")}
        />
      </AuthCard>

      {/* Dev Quick Test Credentials Helper */}
      <div className="w-full max-w-[420px] rounded-lg border border-border/50 bg-card/60 p-3 text-xs text-muted-foreground backdrop-blur-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground mb-2 text-[0.72rem]">
          <KeyRoundIcon className="size-3.5 text-primary" />
          <span>
            Tài khoản Dev mẫu (Mật khẩu chung:{" "}
            <code className="text-primary font-mono font-bold">
              Password123!
            </code>
            )
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickFill("teacher@ielts.liuhocngoaingu.com")}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[0.68rem] text-foreground hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
          >
            <UserCheckIcon className="size-3 text-emerald-500" />
            <span>teacher@ielts.liuhocngoaingu.com (Giáo viên)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickFill("learnerteacher@ielts.liuhocngoaingu.com")
            }
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[0.68rem] text-foreground hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
          >
            <UserCheckIcon className="size-3 text-violet-500" />
            <span>learnerteacher@ielts.liuhocngoaingu.com (Dual)</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill("learner@ielts-prep.vn")}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[0.68rem] text-foreground hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
          >
            <UserCheckIcon className="size-3 text-blue-500" />
            <span>learner@ielts-prep.vn (Học viên)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
