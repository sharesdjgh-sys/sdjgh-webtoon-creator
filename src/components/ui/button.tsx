import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 tracking-tight",
  {
    variants: {
      variant: {
        default:     "bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] hover:scale-[1.02]",
        primary:     "bg-[#7C3AED] text-white hover:bg-[#6D28D9] hover:scale-[1.02] shadow-[0_4px_20px_rgba(124,58,237,0.3)]",
        secondary:   "bg-[#F4F1EC] text-[#1A1A1A] hover:bg-[#EBE7E0] border border-[#EBE7E0]",
        outline:     "border border-[#EBE7E0] bg-white text-[#1A1A1A] hover:bg-[#FBF9F6]",
        ghost:       "hover:bg-[#F4F1EC] text-[#1A1A1A]",
        destructive: "bg-red-500 text-white hover:bg-red-600",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 px-4 text-xs",
        lg:      "h-12 px-7 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
