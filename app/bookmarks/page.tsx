import { DEMO_USER_ID } from "@/lib/mock-data";
import { listBookmarks } from "@/server/bookmarks/queries";
import { BookmarkItem } from "@/components/bookmarks/BookmarkItem";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const bookmarks = await listBookmarks(DEMO_USER_ID);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm text-ink-muted">Сохранённые места</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">Закладки</h1>

      {bookmarks.length === 0 ? (
        <p className="mt-10 text-ink-muted">
          Пока пусто. Закладка появится здесь, как только вы отметите место в
          книге во время чтения.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-3">
          {bookmarks.map((bookmark) => (
            <BookmarkItem key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  );
}
