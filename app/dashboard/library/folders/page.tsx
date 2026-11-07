import Link from "next/link";
import { addLibraryFolder, removeLibraryFolder } from "@/app/actions/library";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { RescanButton } from "@/components/library-rescan";
import { Button, Card, CardHeader, EmptyState, Input } from "@/components/ui";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canOpenLibrary } from "@/lib/library/access";
import { getT } from "@/lib/locale";

export default async function LibraryFoldersPage() {
  if (!(await canOpenLibrary())) return null;
  const [t, session, roots] = await Promise.all([
    getT(),
    auth(),
    db.libraryRoot.findMany({ orderBy: { priority: "asc" }, include: { _count: { select: { files: true } } } }),
  ]);
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/dashboard/library" className="inline-flex text-sm font-bold text-violet-700">
        {t.libBackToLibrary}
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.libFolders}</h1>
        <p className="text-sm text-slate-500">{t.libFoldersDesc}</p>
      </div>

      <Card>
        <CardHeader title={t.libFolders} />
        {roots.length === 0 ? (
          <EmptyState message={t.libNoFolders} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {roots.map((root, index) => (
              <li key={root.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold break-all text-slate-900" dir="ltr">{root.path}</p>
                  <p className="text-sm text-slate-500">
                    {t.libFilesCount} {root._count.files}
                    {index === 0 && roots.length > 1 ? ` · ${t.libMainFolder}` : ""}
                  </p>
                </div>
                {isAdmin && (
                  <form action={removeLibraryFolder.bind(null, root.id)}>
                    <ConfirmSubmitButton size="sm" variant="danger" confirmMessage={`${t.libRemoveFolderConfirm}\n\n${root.path}`}>
                      {t.libRemove}
                    </ConfirmSubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <form action={addLibraryFolder} className="flex gap-2 border-t border-slate-100 p-5">
            <Input name="path" required dir="ltr" placeholder={t.libFolderPlaceholder} aria-label={t.libFolderPlaceholder} />
            <Button type="submit" variant="secondary" className="shrink-0 whitespace-nowrap">{t.libAdd}</Button>
          </form>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader title={t.libRescan} />
          <RescanButton t={t} />
        </Card>
      )}
    </div>
  );
}
