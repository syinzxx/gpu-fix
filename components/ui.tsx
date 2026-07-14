import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  HTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" &&
          "bg-violet-600 text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500",
        variant === "secondary" &&
          "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
        variant === "danger" &&
          "bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50",
        variant === "ghost" && "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-semibold text-slate-600", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white shadow-sm shadow-slate-900/4 ring-1 ring-slate-900/5",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-slate-50 px-4 py-3 text-slate-700", className)}
      {...props}
    />
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        ·
      </div>
      <p className="mt-3 text-sm text-slate-500">{message}</p>
    </div>
  );
}
