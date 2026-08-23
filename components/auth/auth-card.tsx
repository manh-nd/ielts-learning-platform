import * as React from "react";
import { GraduationCapIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AuthCardProps extends React.ComponentProps<"div"> {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  brandName?: string;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
  brandName = "IELTS PREP STUDIO",
  className,
  ...props
}: AuthCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[480px] mx-auto px-4 py-8 sm:py-12",
        className
      )}
      {...props}
    >
      <Card className="shadow-xl sm:shadow-2xl border-border/70 bg-card/98 backdrop-blur-md rounded-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        <CardHeader className="text-center space-y-2 p-0">
          <div className="flex justify-center mb-1">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-xs">
              <GraduationCapIcon className="size-6" />
            </div>
          </div>
          <span className="text-[0.72rem] font-bold uppercase tracking-widest text-primary/80">
            {brandName}
          </span>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="p-0 space-y-5">{children}</CardContent>

        {footer && (
          <CardFooter className="flex flex-col items-center justify-center border-t border-border/50 pt-5 p-0 text-center text-xs text-muted-foreground">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
