import type { SVGProps } from "react";

// Brand icon set: 24px grid, 2px round strokes, currentColor.
const PATHS = {
  monitor: "M3 4h18v12H3z M8 20h8 M12 16v4",
  chip: "M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4",
  core: "M5 5h14v14H5z M9 9h6v6H9z M8 2v3 M12 2v3 M16 2v3 M8 19v3 M12 19v3 M16 19v3",
  fan: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12c0-4 1-6 4-6 M12 12c4 0 6 1 6 4 M12 12c0 4-1 6-4 6 M12 12c-4 0-6-1-6-4",
  code: "M4 4h16v16H4z M9 9l-2 3 2 3 M15 9l2 3-2 3",
  droplet: "M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z M9 12l2 2 4-4",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.8-.7-.7-2.8z",
  chat: "M4 5h16v11H9l-5 4z",
  search: "M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M16 16l5 5",
  printer: "M6 9V3h12v6 M6 18H4v-7h16v7h-2 M7 14h10v7H7z",
  tag: "M3 12V3h9l9 9-9 9z M7.5 7.5h.01",
  note: "M5 3h10l4 4v14H5z M9 12h6 M9 16h6",
  user: "M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21c1-4 4-6 8-6s7 2 8 6",
  money: "M3 7h18v10H3z M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M6 10v4 M18 10v4",
  refresh: "M20 11a8 8 0 0 0-14.9-3.5 M4 4v4h4 M4 13a8 8 0 0 0 14.9 3.5 M20 20v-4h-4",
  alert: "M12 3l10 18H2z M12 10v4 M12 17.5h.01",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  overview: "M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z",
  ticket: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z M14 6v12",
  box: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
  users: "M9 8m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0 M2 20c.8-3.4 3.4-5 7-5s6.2 1.6 7 5 M16 4.5a3.5 3.5 0 0 1 0 7 M18 15c2 .6 3.3 2.3 4 5",
  chart: "M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-3",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6",
  staff: "M12 7m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0 M5 20c.8-3.5 3.5-5.5 7-5.5s6.2 2 7 5.5 M18 3l1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L15 5.3l2-.3z",
  settings: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1",
  message: "M3 5h18v14H3z M3 6l9 7 9-7",
  library: "M4 5l2-2h5l2 3h7v13H4z M9 13h6",
  close: "M6 6l12 12 M18 6L6 18",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// Brand lockup: logo mark + "GPU REPAIR"-style wordmark (last word in accent).
export function BrandMark({ name, size = 36, light = false }: { name: string; size?: number; light?: boolean }) {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;
  return (
    <span className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        width={size}
        height={size}
        className={light ? "shrink-0" : "shrink-0 drop-shadow-[0_0_12px_rgba(41,182,246,0.45)]"}
      />
      <span
        className={`font-display whitespace-nowrap text-[13px] font-black leading-tight sm:text-[15px] ${light ? "text-[#0B2E6B]" : "text-white"}`}
      >
        {words.join(" ")}
        {last && <span className={light ? "text-[#1565C0]" : "text-[#29B6F6]"}> {last}</span>}
      </span>
    </span>
  );
}
