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
        "w-full max-w-[420px] sm:w-[420px] mx-auto px-4 py-8",
        className
      )}
      {...props}
    >
      <Card className="w-full shadow-lg border-border/70 bg-card/98 backdrop-blur-sm rounded-xl p-5 space-y-4">
        <CardHeader className="text-center space-y-1 p-0 pb-1">
          <div className="flex justify-center mb-1">
            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <GraduationCapIcon className="size-5" />
            </div>
          </div>
          <span className="text-[0.7rem] font-bold uppercase tracking-widest text-primary/80">
            {brandName}
          </span>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="p-0 space-y-4">{children}</CardContent>

        {footer && (
          <CardFooter className="flex flex-col items-center justify-center border-t border-border/40 pt-4 p-0 text-center text-xs text-muted-foreground">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
