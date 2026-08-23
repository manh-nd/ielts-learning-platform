import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="label"
      className={cn(
        "flex items-center gap-1 text-xs font-medium leading-none select-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Label };
