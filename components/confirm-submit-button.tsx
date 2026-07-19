"use client";

import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui";

/**
 * A submit button that asks for a native window.confirm() before letting
 * the surrounding form submit. Used for the customer-facing quote
 * approve/decline actions on the public tracking page, where there's no
 * follow-up screen to catch a misclick.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
