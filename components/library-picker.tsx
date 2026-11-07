import { boardTitle, type BoardSummary } from "@/lib/library/search";

function pickerText(board: BoardSummary) {
  const details = [boardTitle(board), board.boardCode, board.revision].filter(Boolean).join(" · ");
  return `${details} #${board.id}`;
}

/** One shared list per page, so rows do not each repeat about 1,600 options. */
export function BoardOptions({ boards, listId }: { boards: BoardSummary[]; listId: string }) {
  return (
    <datalist id={listId}>
      {boards.map((board) => (
        <option key={board.id} value={pickerText(board)} />
      ))}
    </datalist>
  );
}

/** Type to narrow the boards. Submits as the "board" field. */
export function BoardInput({ listId, placeholder }: { listId: string; placeholder: string }) {
  return (
    <input
      name="board"
      required
      list={listId}
      placeholder={placeholder}
      aria-label={placeholder}
      autoComplete="off"
      className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
    />
  );
}
