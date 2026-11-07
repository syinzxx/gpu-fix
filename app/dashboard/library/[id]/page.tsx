import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addBoardAlias, moveFileToBoard, removeBoardAlias, updateBoard } from "@/app/actions/library";
import { Icon } from "@/components/icons";
import { BoardInput, BoardOptions } from "@/components/library-picker";
import { Badge, Button, Card, CardHeader, Input, Label, Textarea } from "@/components/ui";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canOpenLibrary } from "@/lib/library/access";
import { loadBoardSummaries } from "@/lib/library/queries";
import { boardTitle } from "@/lib/library/search";
import { getT } from "@/lib/locale";
import type { Translations } from "@/lib/i18n";

const PICKER_ID = "library-boards";
const TYPE_ORDER = ["BOARDVIEW", "SCHEMATIC", "BOARDVIEW_PDF", "BIOS", "OTHER"];

function typeLabel(type: string, t: Translations) {
  if (type === "BOARDVIEW") return t.libBoardview;
  if (type === "SCHEMATIC") return t.libSchematic;
  if (type === "BOARDVIEW_PDF") return t.libBoardviewPdf;
  if (type === "BIOS") return t.libBios;
  return t.libOther;
}

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await canOpenLibrary())) return null;
  const [t, session, board] = await Promise.all([
    getT(),
    auth(),
    db.board.findUnique({
      where: { id },
      include: {
        aliases: { orderBy: { alias: "asc" } },
        files: { include: { libraryRoot: true, _count: { select: { duplicates: true } } } },
      },
    }),
  ]);
  if (!board) notFound();

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "TECHNICIAN";
  const pickerBoards = canEdit ? await loadBoardSummaries() : [];
  const files = board.files
    .filter((f) => !f.duplicateOfId)
    .sort((a, b) => TYPE_ORDER.indexOf(a.fileType) - TYPE_ORDER.indexOf(b.fileType) || a.originalName.localeCompare(b.originalName));
  // File names stay searchable, but listing every copy here would bury the real names.
  const shownAliases = board.aliases.filter((a) => !/\.[a-z0-9]{2,5}$/i.test(a.alias));
  const save = updateBoard.bind(null, board.id);
  const addAlias = addBoardAlias.bind(null, board.id);
  const fields = [
    { name: "cardBrand", label: t.libBrand, value: board.cardBrand, required: true },
    { name: "gpuModel", label: t.libGpu, value: board.gpuModel, required: true },
    { name: "cardName", label: t.libCardName, value: board.cardName },
    { name: "boardCode", label: t.libBoardCode, value: board.boardCode ?? "" },
    { name: "revision", label: t.libRevision, value: board.revision ?? "" },
    { name: "memoryType", label: t.libMemoryType, value: board.memoryType ?? "" },
    { name: "memorySize", label: t.libMemorySize, value: board.memorySize ?? "" },
  ];

  return (
    <div className="space-y-4">
      {canEdit && <BoardOptions boards={pickerBoards} listId={PICKER_ID} />}
      <Link href="/dashboard/library" className="inline-flex items-center gap-1 text-sm font-bold text-violet-700">
        {t.libBackToLibrary}
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{boardTitle(board)}</h1>
        <p className="text-sm text-slate-500">
          {[board.gpuMaker, board.generation, board.boardCode, board.revision && `${t.libRevision} ${board.revision}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title={t.libFiles} />
            <ul className="divide-y divide-slate-100">
              {files.map((file) => (
                <li key={file.id} className="space-y-1.5 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-violet-50 text-violet-700">{typeLabel(file.fileType, t)}</Badge>
                    <span className="min-w-0 font-semibold break-all text-slate-900">{file.originalName}</span>
                    {file.status === "MISSING" && <Badge className="bg-rose-100 text-rose-700">{t.libMissing}</Badge>}
                    {file._count.duplicates > 0 && (
                      <Badge className="bg-slate-100 text-slate-600">
                        {t.libCopies} {file._count.duplicates}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs break-all text-slate-400" dir="ltr">
                    {path.win32.join(file.libraryRoot.path, file.relativePath)}
                  </p>
                  {canEdit && (
                    <details>
                      <summary className="cursor-pointer text-xs font-bold text-violet-700">{t.libMoveFile}</summary>
                      <form action={moveFileToBoard.bind(null, file.id)} className="mt-2 flex gap-2">
                        <BoardInput listId={PICKER_ID} placeholder={t.libChooseBoard} />
                        <Button type="submit" size="sm" variant="secondary" className="shrink-0 whitespace-nowrap">
                          {t.libMoveFile}
                        </Button>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 px-5 py-2.5 text-sm text-slate-500">{t.libFilesNote}</p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title={t.libAliases} />
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap gap-1.5">
                {shownAliases.map((alias) => (
                  <span
                    key={alias.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-0.5 ps-2.5 pe-1 text-xs font-semibold break-all text-slate-700"
                  >
                    {alias.alias}
                    {canEdit && (
                      <form action={removeBoardAlias.bind(null, alias.id, board.id)} className="inline-flex">
                        <button type="submit" aria-label={`${t.libRemove} ${alias.alias}`} className="cursor-pointer rounded-full p-0.5 hover:bg-rose-100 hover:text-rose-600">
                          <Icon name="close" size={12} />
                        </button>
                      </form>
                    )}
                  </span>
                ))}
              </div>
              {canEdit && (
                <form action={addAlias} className="flex gap-2">
                  <Input name="alias" required placeholder={t.libAddAlias} aria-label={t.libAddAlias} />
                  <Button type="submit" variant="secondary">{t.libAdd}</Button>
                </form>
              )}
            </div>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader title={t.libEditBoard} />
              <form action={save} className="space-y-3 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.name}>
                      <Label htmlFor={field.name}>{field.label}</Label>
                      <Input id={field.name} name={field.name} defaultValue={field.value} required={field.required} />
                    </div>
                  ))}
                </div>
                <div>
                  <Label htmlFor="notes">{t.libNotes}</Label>
                  <Textarea id="notes" name="notes" rows={3} defaultValue={board.notes ?? ""} />
                </div>
                <Button type="submit">{t.libSave}</Button>
              </form>
            </Card>
          ) : (
            board.notes && (
              <Card>
                <CardHeader title={t.libNotes} />
                <p className="p-5 text-sm whitespace-pre-wrap text-slate-700">{board.notes}</p>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
