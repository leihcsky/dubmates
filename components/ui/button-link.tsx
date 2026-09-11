"use client";

import type { ComponentProps, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    children: ReactNode;
  };

/**
 * Client Link styled like Button — avoids Radix Slot + RSC Link crashes
 * during next-intl locale soft navigation.
 */
export function ButtonLink({
  className,
  variant,
  size,
  children,
  ...linkProps
}: ButtonLinkProps) {
  return (
    <Link {...linkProps} className={cn(buttonVariants({ variant, size, className }))}>
      {children}
    </Link>
  );
}
