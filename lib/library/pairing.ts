import { comparableStem } from "./classify";

export type PairFile = { path: string; name: string; fileType: string };

const folderOf = (file: PairFile) => file.path.slice(0, file.path.lastIndexOf("\\"));
const stemOf = (file: PairFile) => comparableStem(file.name.replace(/\.[^.]+$/, ""));

/**
 * The boardview and PDF to open first: matching names, then the same folder.
 * A real schematic beats a PDF print of the boardview.
 */
export function choosePair(files: PairFile[]): { board: PairFile | null; pdf: PairFile | null } {
  const boards = files.filter((f) => f.fileType === "BOARDVIEW");
  const pdfs = [
    ...files.filter((f) => f.fileType === "SCHEMATIC"),
    ...files.filter((f) => f.fileType === "BOARDVIEW_PDF"),
  ];
  let best = { board: boards[0] ?? null, pdf: pdfs[0] ?? null };
  let bestScore = -1;
  for (const board of boards) {
    for (const pdf of pdfs) {
      const score = (stemOf(board) === stemOf(pdf) ? 2 : 0) + (folderOf(board) === folderOf(pdf) ? 1 : 0);
      if (score > bestScore) {
        best = { board, pdf };
        bestScore = score;
      }
    }
  }
  return best;
}
