import { addBoardNote, deleteBoardNote } from "@/app/actions/library";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, Select, Textarea } from "@/components/ui";
import type { Translations } from "@/lib/i18n";

type Note = { id: string; kind: string; title: string; body: string | null; boardId: string | null; createdBy: { name: string } | null };

const KINDS = ["FAULT", "POWER_ON", "RAIL"] as const;

export function BoardNotes({
  boardId,
  generation,
  notes,
  canEdit,
  t,
}: {
  boardId: string;
  generation: string;
  notes: Note[];
  canEdit: boolean;
  t: Translations;
}) {
  const headings: Record<string, string> = { FAULT: t.noteFaults, POWER_ON: t.notePowerOn, RAIL: t.noteRails };
  const add = addBoardNote.bind(null, boardId);

  return (
    <Card>
      <CardHeader title={`${t.noteTitle} (${notes.length})`} />
      {notes.length === 0 && <EmptyState message={t.noteEmpty} />}
      {KINDS.map((kind) => {
        const list = notes.filter((note) => note.kind === kind);
        if (!list.length) return null;
        const Tag = kind === "POWER_ON" ? "ol" : "ul";
        return (
          <section key={kind} className="border-b border-slate-100 px-5 py-3">
            <h3 className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">{headings[kind]}</h3>
            <Tag className={kind === "POWER_ON" ? "list-inside list-decimal space-y-1.5" : "space-y-1.5"}>
              {list.map((note) => (
                <li key={note.id} className="text-sm text-slate-800">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{note.title}</span>
                    {!note.boardId && <Badge className="bg-slate-100 text-slate-600">{t.noteAll} {generation}</Badge>}
                    {canEdit && (
                      <form action={deleteBoardNote.bind(null, note.id, boardId)} className="inline">
                        <ConfirmSubmitButton size="sm" variant="ghost" confirmMessage={t.noteDeleteConfirm}>{t.libRemove}</ConfirmSubmitButton>
                      </form>
                    )}
                  </span>
                  {note.body && <span className="block whitespace-pre-wrap text-slate-600">{note.body}</span>}
                  {note.createdBy && <span className="block text-xs text-slate-400">{note.createdBy.name}</span>}
                </li>
              ))}
            </Tag>
          </section>
        );
      })}
      {canEdit && (
        <form action={add} className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="note-kind">{t.noteKind}</Label>
              <Select id="note-kind" name="kind" defaultValue="FAULT">
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>{headings[kind]}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="note-scope">{t.noteScope}</Label>
              <Select id="note-scope" name="scope" defaultValue="BOARD">
                <option value="BOARD">{t.noteThisBoard}</option>
                <option value="FAMILY">{t.noteAll} {generation}</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="note-title">{t.noteHeading}</Label>
            <Input id="note-title" name="title" required />
          </div>
          <div>
            <Label htmlFor="note-body">{t.noteDetail}</Label>
            <Textarea id="note-body" name="body" rows={2} />
          </div>
          <Button type="submit" variant="secondary">{t.noteAdd}</Button>
        </form>
      )}
    </Card>
  );
}
