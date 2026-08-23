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
  brandName = "IELTS Prep Studio",
  className,
  ...props
}: AuthCardProps) {
  return (
    <div
      className={cn("w-full max-w-md mx-auto px-4 py-8", className)}
      {...props}
    >
      <Card className="shadow-lg border-border/60 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-1 pb-4">
          <div className="flex justify-center mb-2">
            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <GraduationCapIcon className="size-5" />
            </div>
          </div>
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {brandName}
          </span>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-xs text-muted-foreground">
              {description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">{children}</CardContent>

        {footer && (
          <CardFooter className="flex flex-col items-center justify-center border-t border-border/40 pt-4 text-center text-xs text-muted-foreground">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
