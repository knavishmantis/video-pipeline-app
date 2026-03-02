import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn("flex h-10 w-full rounded-lg px-3 py-2 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50", className)}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          ...style,
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--gold)';
          (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 2px var(--gold-dim)';
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-default)';
          (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
          props.onBlur?.(e);
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
