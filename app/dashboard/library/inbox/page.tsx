import path from "node:path";
import Link from "next/link";
import { createBoardFromFile, moveFileToBoard } from "@/app/actions/library";
import { BoardInput, BoardOptions } from "@/components/library-picker";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canOpenLibrary } from "@/lib/library/access";
import { loadBoardSummaries } from "@/lib/library/queries";
import { naturalCompare } from "@/lib/library/normalise";
import { getT } from "@/lib/locale";
import type { Translations } from "@/lib/i18n";

const MAX_SHOWN = 50;
const PICKER_ID = "library-boards";

type Suggestion = { gpuModel?: string; cardBrand?: string; boardCode?: string | null; revision?: string | null };

function reasonText(reason: string | null, t: Translations) {
  if (!reason) return "";
  const known: [string, string][] = [
    ["The brand could not", t.libReasonBrand],
    ["The GPU could not", t.libReasonGpu],
    ["The file is empty", t.libReasonEmpty],
    ["Only a V number", t.libReasonGuess],
    ["Nothing in the name", t.libReasonNothing],
  ];
  return known.filter(([start]) => reason.includes(start)).map(([, text]) => text).join(" ");
}

export default async function InboxPage() {
  if (!(await canOpenLibrary())) return null;
  const [t, session, files, boards] = await Promise.all([
    getT(),
    auth(),
    db.boardFile.findMany({
      where: { reviewState: "INBOX", status: "ACTIVE", duplicateOfId: null },
      include: { libraryRoot: true },
    }),
    loadBoardSummaries(),
  ]);
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "TECHNICIAN";
  const sorted = files.sort((a, b) => naturalCompare(a.relativePath, b.relativePath));

  return (
    <div className="space-y-4">
      <Link href="/dashboard/library" className="inline-flex text-sm font-bold text-violet-700">
        {t.libBackToLibrary}
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          {t.libInbox} ({sorted.length})
        </h1>
        <p className="text-sm text-slate-500">{t.libInboxDesc}</p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState message={t.libInboxEmpty} />
        </Card>
      ) : (
        <>
          {canEdit && <BoardOptions boards={boards} listId={PICKER_ID} />}
          {sorted.slice(0, MAX_SHOWN).map((file) => {
            const guess: Suggestion = file.suggestion ? JSON.parse(file.suggestion) : {};
            return (
              <Card key={file.id} className="space-y-3 p-4">
                <div className="min-w-0">
                  <p className="font-bold break-all text-slate-900">{file.originalName}</p>
                  <p className="text-sm text-slate-500">{reasonText(file.reviewReason, t)}</p>
                  <p className="text-xs break-all text-slate-400" dir="ltr">
                    {path.win32.join(file.libraryRoot.path, file.relativePath)}
                  </p>
                </div>
                {canEdit && (
                  <div className="grid gap-3 xl:grid-cols-2">
                    <form action={moveFileToBoard.bind(null, file.id)} className="flex items-center gap-2">
                      <BoardInput listId={PICKER_ID} placeholder={t.libChooseBoard} />
                      <Button type="submit" size="sm" className="shrink-0 whitespace-nowrap">{t.libFileUnder}</Button>
                    </form>
                    <form action={createBoardFromFile.bind(null, file.id)} className="flex flex-wrap items-center gap-2">
                      <Input name="cardBrand" required defaultValue={guess.cardBrand ?? ""} placeholder={t.libBrand} aria-label={t.libBrand} className="w-28 flex-1" />
                      <Input
                        name="gpuModel"
                        required
                        defaultValue={guess.gpuModel === "Unidentified" ? "" : (guess.gpuModel ?? "")}
                        placeholder={t.libGpu}
                        aria-label={t.libGpu}
                        className="w-32 flex-1"
                      />
                      <Input name="boardCode" defaultValue={guess.boardCode ?? ""} placeholder={t.libBoardCode} aria-label={t.libBoardCode} className="w-28 flex-1" />
                      <Input name="revision" defaultValue={guess.revision ?? ""} placeholder={t.libRevision} aria-label={t.libRevision} className="w-20 flex-none" />
                      <Button type="submit" size="sm" variant="secondary" className="shrink-0 whitespace-nowrap">{t.libNewBoard}</Button>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
          {sorted.length > MAX_SHOWN && (
            <p className="text-center text-sm text-slate-500">
              {t.libShowing} {MAX_SHOWN} / {sorted.length}
            </p>
          )}
        </>
      )}
    </div>
  );
}
