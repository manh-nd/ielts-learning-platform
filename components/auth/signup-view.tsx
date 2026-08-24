"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { signUp, signIn } from "@/lib/auth-client";
import type { SignUpFormData } from "@/components/auth/types";

export interface SignUpViewProps {
  showGoogleOAuth?: boolean;
}

function SignUpContent({ showGoogleOAuth = false }: SignUpViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleEmailSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL: "/auth/redirect",
      });

      if (response.error) {
        let msg = "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.";
        if (
          response.error.message?.includes("already exists") ||
          response.error.message?.includes("User already exists") ||
          response.error.status === 422
        ) {
          msg =
            "Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.";
        } else if (
          response.error.status === 500 ||
          response.error.message?.includes("Failed query") ||
          response.error.message?.includes("ECONNREFUSED")
        ) {
          msg = "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.";
        } else if (response.error.message?.includes("Password")) {
          msg = "Mật khẩu không đáp ứng yêu cầu bảo mật.";
        } else if (response.error.message) {
          msg = response.error.message;
        }
        setErrorMessage(msg);
      } else {
        router.push("/auth/redirect");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message ||
          "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/auth/redirect",
      });
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message ||
          "Đăng ký bằng Google không thành công. Vui lòng thử lại."
      );
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <AuthCard
        title="Tạo tài khoản mới"
        description="Tham gia nền tảng luyện thi IELTS thông minh cùng AI và đội ngũ Giáo viên chuyên gia."
      >
        <SignUpForm
          onSubmit={handleEmailSignUp}
          onGoogleSignIn={handleGoogleSignUp}
          showGoogleOAuth={showGoogleOAuth}
          isLoading={isLoading}
          isGoogleLoading={isGoogleLoading}
          errorMessage={errorMessage}
          onLoginClick={() => router.push("/login")}
        />
      </AuthCard>
    </div>
  );
}

export function SignUpView(props: SignUpViewProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <SignUpContent {...props} />
    </React.Suspense>
  );
}
