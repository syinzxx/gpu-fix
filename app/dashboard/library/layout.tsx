import { Card, EmptyState } from "@/components/ui";
import { canOpenLibrary } from "@/lib/library/access";
import { getT } from "@/lib/locale";

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  if (await canOpenLibrary()) return children;
  const t = await getT();
  return (
    <Card>
      <EmptyState message={t.libPcOnly} />
    </Card>
  );
}
