"use client";

import {
  Loader2Icon,
  AlertTriangleIcon,
  ArrowRightIcon,
  GraduationCapIcon,
  LogInIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UserRole } from "./types";
import { cn } from "@/lib/utils";

export interface AuthRedirectViewProps {
  role?: UserRole | null;
  destinationPath?: string;
  status?: "loading" | "redirecting" | "error";
  errorMessage?: string | null;
  onRetry?: () => void;
  onManualRedirect?: () => void;
  onBackToLogin?: () => void;
  className?: string;
}

export function AuthRedirectView({
  role,
  destinationPath,
  status = "loading",
  errorMessage = null,
  onRetry,
  onManualRedirect,
  onBackToLogin,
  className,
}: AuthRedirectViewProps) {
  const isError = status === "error" || Boolean(errorMessage);

  const getDestinationLabel = () => {
    if (role === "teacher") {
      return "Không gian Chấm bài Giáo viên";
    }
    if (role === "learner") {
      return "Bảng điều khiển Học viên";
    }
    return "Trang tổng quan";
  };

  const getTargetUrl = () => {
    if (destinationPath) return destinationPath;
    if (role === "teacher") return "/teacher/review";
    if (role === "learner") return "/learner/dashboard";
    return "/";
  };

  return (
    <div
      className={cn(
        "flex min-h-[60vh] w-full items-center justify-center px-4 py-12",
        className
      )}
    >
      <Card className="w-full max-w-md shadow-xl border-border/60 bg-card/95 backdrop-blur-sm text-center">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex justify-center mb-2">
            <div
              className={cn(
                "inline-flex size-12 items-center justify-center rounded-2xl ring-1 transition-colors",
                isError
                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                  : "bg-primary/10 text-primary ring-primary/20"
              )}
            >
              {isError ? (
                <AlertTriangleIcon className="size-6" />
              ) : (
                <GraduationCapIcon className="size-6" />
              )}
            </div>
          </div>

          <CardTitle className="text-lg font-bold tracking-tight text-foreground">
            {isError
              ? "Không thể hoàn tất điều hướng"
              : "Đang xác thực và chuyển hướng..."}
          </CardTitle>

          <CardDescription className="text-xs text-muted-foreground max-w-xs mx-auto">
            {isError
              ? errorMessage ||
                "Đã xảy ra lỗi trong quá trình xác thực phiên làm việc hoặc phiên đăng nhập đã hết hạn."
              : `Hệ thống đang chuẩn bị môi trường và kết nối tới ${getDestinationLabel()}.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="py-4">
          {isError ? (
            <div className="flex flex-col gap-2">
              {onRetry && (
                <Button
                  onClick={onRetry}
                  variant="default"
                  size="default"
                  className="w-full justify-center gap-1.5"
                >
                  <RotateCcwIcon className="size-3.5" />
                  <span>Thử lại</span>
                </Button>
              )}
              {onBackToLogin ? (
                <Button
                  onClick={onBackToLogin}
                  variant="outline"
                  size="default"
                  className="w-full justify-center gap-1.5"
                >
                  <LogInIcon className="size-3.5" />
                  <span>Quay lại trang Đăng nhập</span>
                </Button>
              ) : (
                <Button
                  render={
                    <a
                      href="/login"
                      className="inline-flex items-center gap-1.5"
                    >
                      <LogInIcon className="size-3.5" />
                      <span>Quay lại trang Đăng nhập</span>
                    </a>
                  }
                  variant="outline"
                  size="default"
                  className="w-full justify-center"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <div className="relative flex items-center justify-center">
                <Loader2Icon className="size-8 animate-spin text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                Đang chuyển tới{" "}
                <span className="font-semibold text-foreground">
                  {getTargetUrl()}
                </span>
              </p>
            </div>
          )}
        </CardContent>

        {!isError && (
          <CardFooter className="flex flex-col items-center justify-center border-t border-border/40 pt-4 text-center text-xs text-muted-foreground">
            <p className="mb-2 text-[0.7rem]">
              Nếu trang không tự động chuyển hướng trong giây lát:
            </p>
            {onManualRedirect ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onManualRedirect}
                className="gap-1.5 text-xs"
              >
                <span>Tiếp tục tới {getDestinationLabel()}</span>
                <ArrowRightIcon className="size-3" />
              </Button>
            ) : (
              <Button
                render={
                  <a
                    href={getTargetUrl()}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span>Tiếp tục tới {getDestinationLabel()}</span>
                    <ArrowRightIcon className="size-3" />
                  </a>
                }
                variant="outline"
                size="sm"
                className="text-xs"
              />
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
