import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OAuthGoogleButtonProps extends Omit<
  React.ComponentProps<typeof Button>,
  "onClick"
> {
  onClick?: () => void | Promise<void>;
  isLoading?: boolean;
  label?: string;
  loadingText?: string;
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function OAuthGoogleButton({
  onClick,
  isLoading = false,
  disabled = false,
  label = "Tiếp tục với Google",
  loadingText = "Đang chuyển hướng tới Google...",
  className,
  ...props
}: OAuthGoogleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      disabled={disabled || isLoading}
      onClick={onClick}
      className={cn(
        "w-full h-9 justify-center gap-2 border-border/80 bg-background hover:bg-muted/60 font-medium text-xs text-foreground transition-all shadow-xs",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          <GoogleIcon />
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}
