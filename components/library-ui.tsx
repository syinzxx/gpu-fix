import { Badge } from "@/components/ui";
import { FILE_BADGES, hasBadge, type BoardSummary } from "@/lib/library/search";
import type { Translations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function badgeLabel(key: string, t: Translations): string {
  if (key === "boardview") return t.libBoardview;
  if (key === "schematic") return t.libSchematic;
  return t.libBios;
}

/** Shows what a board has, so nobody opens it to find out. */
export function BoardBadges({ board, t }: { board: BoardSummary; t: Translations }) {
  return (
    <span className="flex flex-wrap gap-1">
      {FILE_BADGES.map(({ key }) => (
        <Badge
          key={key}
          className={cn(
            hasBadge(board, key)
              ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
              : "text-slate-400 line-through ring-1 ring-dashed ring-slate-200"
          )}
        >
          {badgeLabel(key, t)}
        </Badge>
      ))}
    </span>
  );
}
