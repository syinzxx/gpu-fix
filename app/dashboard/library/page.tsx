import Link from "next/link";
import { BoardBadges, badgeLabel } from "@/components/library-ui";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { canOpenLibrary } from "@/lib/library/access";
import { inboxCount, loadBoardSummaries } from "@/lib/library/queries";
import {
  FILE_BADGES,
  boardTitle,
  brandTree,
  closeMatches,
  filterBoards,
  gpuTree,
  isExactCode,
  type BoardSummary,
  type TreeNode,
} from "@/lib/library/search";
import { getT } from "@/lib/locale";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 150;

type Params = { q?: string; mode?: string; maker?: string; generation?: string; gpu?: string; brand?: string; has?: string | string[] };

function hrefWith(params: Params, changes: Partial<Params>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...changes })) {
    for (const item of [value].flat()) if (item) next.append(key, item);
  }
  const query = next.toString();
  return query ? `/dashboard/library?${query}` : "/dashboard/library";
}

function TreeLink({ node, href, active, depth }: { node: TreeNode; href: string; active: boolean; depth: number }) {
  return (
    <Link
      href={href}
      style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md py-1 pe-2 text-sm font-semibold transition-colors",
        active ? "bg-violet-600 text-white" : "text-slate-700 hover:bg-violet-50"
      )}
    >
      <span className="min-w-0 truncate">{node.label}</span>
      <span className={cn("text-xs tabular-nums", active ? "opacity-90" : "text-slate-400")}>{node.count}</span>
    </Link>
  );
}

function GpuTreeView({ nodes, params }: { nodes: TreeNode[]; params: Params }) {
  const clear = { maker: undefined, generation: undefined, gpu: undefined, brand: undefined };
  return nodes.map((maker) => {
    const makerOpen = params.maker === maker.label;
    return (
      <div key={maker.label} className="mb-2">
        <Link
          href={hrefWith(params, { ...clear, maker: makerOpen && !params.generation ? undefined : maker.label })}
          className={cn(
            "flex justify-between rounded-md px-2 py-1 text-xs font-bold tracking-widest uppercase",
            makerOpen && !params.generation ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50"
          )}
        >
          {maker.label}
          <span className="tabular-nums">{maker.count}</span>
        </Link>
        {maker.children.map((generation) => {
          const generationOpen = params.generation === generation.label;
          return (
            <div key={generation.label}>
              <TreeLink
                node={generation}
                depth={0}
                active={generationOpen && !params.gpu}
                href={hrefWith(params, { ...clear, maker: maker.label, generation: generationOpen && !params.gpu ? undefined : generation.label })}
              />
              {generationOpen &&
                generation.children.map((gpu) => {
                  const gpuOpen = params.gpu === gpu.label;
                  return (
                    <div key={gpu.label}>
                      <TreeLink
                        node={gpu}
                        depth={1}
                        active={gpuOpen && !params.brand}
                        href={hrefWith(params, { ...clear, maker: maker.label, generation: generation.label, gpu: gpu.label })}
                      />
                      {gpuOpen &&
                        gpu.children.map((brand) => (
                          <TreeLink
                            key={brand.label}
                            node={brand}
                            depth={2}
                            active={params.brand === brand.label}
                            href={hrefWith(params, { ...clear, maker: maker.label, generation: generation.label, gpu: gpu.label, brand: brand.label })}
                          />
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    );
  });
}

function BrandTreeView({ nodes, params }: { nodes: TreeNode[]; params: Params }) {
  const clear = { maker: undefined, generation: undefined, gpu: undefined };
  return nodes.map((brand) => {
    const open = params.brand === brand.label;
    return (
      <div key={brand.label}>
        <TreeLink
          node={brand}
          depth={0}
          active={open && !params.gpu}
          href={hrefWith(params, { ...clear, brand: open && !params.gpu ? undefined : brand.label })}
        />
        {open &&
          brand.children.map((gpu) => (
            <TreeLink
              key={gpu.label}
              node={gpu}
              depth={1}
              active={params.gpu === gpu.label}
              href={hrefWith(params, { ...clear, brand: brand.label, gpu: gpu.label })}
            />
          ))}
      </div>
    );
  });
}

function groupByGpu(boards: BoardSummary[]) {
  const groups = new Map<string, BoardSummary[]>();
  for (const board of boards) groups.set(board.gpuModel, [...(groups.get(board.gpuModel) ?? []), board]);
  return [...groups];
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  if (!(await canOpenLibrary())) return null;
  const [t, all, waiting] = await Promise.all([getT(), loadBoardSummaries(), inboxCount()]);

  const has = [params.has ?? []].flat();
  const mode = params.mode === "brand" ? "brand" : "gpu";
  const found = filterBoards(all, { ...params, has });
  const suggestions = found.length === 0 && params.q ? closeMatches(all, params.q) : [];
  const shown = found.slice(0, MAX_SHOWN);
  const switchClear = { mode: undefined, maker: undefined, generation: undefined, gpu: undefined, brand: undefined };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.library}</h1>
          <p className="text-sm text-slate-500">{t.libraryDesc}</p>
        </div>
        <Link href="/dashboard/library/inbox">
          <Button variant="secondary" type="button">
            {t.libInbox} ({waiting})
          </Button>
        </Link>
      </div>

      <form className="flex items-center gap-2 rounded-xl border-2 border-violet-500 bg-white px-3">
        <Icon name="search" size={20} className="shrink-0 text-violet-600" />
        <input
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          placeholder={t.libSearchPlaceholder}
          aria-label={t.libSearchPlaceholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-base font-semibold placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
        />
        {mode === "brand" && <input type="hidden" name="mode" value="brand" />}
        {has.map((key) => (
          <input key={key} type="hidden" name="has" value={key} />
        ))}
      </form>

      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="max-h-[75vh] overflow-y-auto p-3">
          <div className="mb-3 grid grid-cols-2 gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {(["gpu", "brand"] as const).map((value) => (
              <Link
                key={value}
                href={hrefWith(params, { ...switchClear, mode: value === "brand" ? "brand" : undefined })}
                className={cn(
                  "rounded-md py-1 text-center text-sm font-bold",
                  mode === value ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
                )}
              >
                {value === "gpu" ? t.libGpuFirst : t.libBrandFirst}
              </Link>
            ))}
          </div>
          {mode === "gpu" ? (
            <GpuTreeView nodes={gpuTree(all)} params={params} />
          ) : (
            <BrandTreeView nodes={brandTree(all)} params={params} />
          )}
        </Card>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILE_BADGES.map(({ key }) => {
              const on = has.includes(key);
              return (
                <Link key={key} href={hrefWith(params, { has: on ? has.filter((k) => k !== key) : [...has, key] })}>
                  <Badge className={on ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-violet-400"}>
                    {t.libHas} {badgeLabel(key, t)}
                  </Badge>
                </Link>
              );
            })}
            <span className="ms-auto text-sm font-semibold text-slate-500">
              {found.length} {t.libBoards}
              {found.length > MAX_SHOWN ? ` · ${t.libShowing} ${MAX_SHOWN}` : ""}
            </span>
          </div>

          {found.length === 0 ? (
            <Card className="p-5 text-center">
              <EmptyState message={t.libNoBoards} />
              {suggestions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 pb-2">
                  <span className="text-sm text-slate-500">{t.libCloseMatches}</span>
                  {suggestions.map((name) => (
                    <Link key={name} href={hrefWith(params, { q: name })}>
                      <Badge className="bg-white text-violet-700 ring-1 ring-violet-200">{name}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            groupByGpu(shown).map(([gpu, boards]) => (
              <section key={gpu} className="space-y-1.5">
                <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase">{gpu}</h2>
                {boards.map((board) => (
                  <Link
                    key={board.id}
                    href={`/dashboard/library/${board.id}`}
                    className="grid gap-2 rounded-xl bg-white px-4 py-2.5 ring-1 ring-slate-900/5 transition hover:ring-violet-400 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-900">
                        {boardTitle(board)}
                        {params.q && isExactCode(board, params.q) && (
                          <Badge className="ms-2 bg-violet-600 text-white">{t.libExactCode}</Badge>
                        )}
                      </span>
                      <span className="block truncate text-sm text-slate-500">
                        {[board.boardCode, board.revision && `${t.libRevision} ${board.revision}`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <BoardBadges board={board} t={t} />
                  </Link>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
