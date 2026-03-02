import * as React from "react";
import { cn } from "../../lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn("block text-xs font-semibold mb-1.5 uppercase tracking-wide", className)}
        style={{
          color: 'var(--text-secondary)',
          letterSpacing: '0.06em',
          ...style,
        }}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
