import Link from "next/link";
import { linkTicketToBoard, unlinkTicketBoard } from "@/app/actions/library";
import { BoardInput, BoardOptions } from "@/components/library-picker";
import { Button, Card, CardHeader } from "@/components/ui";
import { canOpenLibrary } from "@/lib/library/access";
import { loadBoardSummaries } from "@/lib/library/queries";
import { boardTitle, suggestBoards } from "@/lib/library/search";
import type { Translations } from "@/lib/i18n";

const PICKER_ID = "ticket-boards";

type Props = {
  ticket: {
    id: string;
    brand: string;
    model: string;
    board: { id: string; cardBrand: string; gpuModel: string; cardName: string; boardCode: string | null; revision: string | null } | null;
  };
  t: Translations;
};

/** Links a repair to a board, so the board page can show its history. PC app only, like the Library. */
export async function TicketBoardCard({ ticket, t }: Props) {
  if (!(await canOpenLibrary())) return null;
  const link = linkTicketToBoard.bind(null, ticket.id);

  if (ticket.board) {
    return (
      <Card>
        <CardHeader title={t.libBoardCard} />
        <div className="space-y-2 p-5">
          <Link href={`/dashboard/library/${ticket.board.id}`} className="block font-bold text-violet-700">
            {boardTitle(ticket.board)}
          </Link>
          <p className="text-sm text-slate-500">
            {[ticket.board.boardCode, ticket.board.revision && `${t.libRevision} ${ticket.board.revision}`].filter(Boolean).join(" · ")}
          </p>
          <form action={unlinkTicketBoard.bind(null, ticket.id)}>
            <Button type="submit" size="sm" variant="ghost">{t.libUnlink}</Button>
          </form>
        </div>
      </Card>
    );
  }

  const boards = await loadBoardSummaries();
  const suggestions = suggestBoards(boards, ticket.brand, ticket.model);

  return (
    <Card>
      <CardHeader title={t.libBoardCard} />
      <div className="space-y-3 p-5">
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm text-slate-500">{t.libSuggestedBoards}</p>
            {suggestions.map((board) => (
              <form key={board.id} action={link}>
                <input type="hidden" name="board" value={`#${board.id}`} />
                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-lg bg-white px-3 py-1.5 text-start text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:ring-violet-400"
                >
                  {boardTitle(board)}
                  <span className="block text-xs font-normal text-slate-500">
                    {[board.boardCode, board.revision && `${t.libRevision} ${board.revision}`].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </form>
            ))}
          </div>
        )}
        <BoardOptions boards={boards} listId={PICKER_ID} />
        <form action={link} className="flex gap-2">
          <BoardInput listId={PICKER_ID} placeholder={t.libChooseBoard} />
          <Button type="submit" size="sm" variant="secondary" className="shrink-0 whitespace-nowrap">{t.libLinkBoard}</Button>
        </form>
      </div>
    </Card>
  );
}
