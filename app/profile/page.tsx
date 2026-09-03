import { getBooks } from "@/server/books/queries";
import { listBookmarks } from "@/server/bookmarks/queries";
import { DEMO_USER_ID } from "@/lib/mock-data";

export default async function ProfilePage() {
  const [books, bookmarks] = await Promise.all([
    getBooks(),
    listBookmarks(DEMO_USER_ID),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm text-ink-muted">Профиль</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">
        Демо-читатель
      </h1>
      <p className="mt-3 max-w-md text-ink-muted">
        Авторизация ещё не подключена — все сейчас читают под одним
        демо-профилем. Google-вход добавим на Этапе 5.
      </p>

      <dl className="mt-10 grid max-w-xs grid-cols-2 gap-6">
        <div>
          <dt className="text-sm text-ink-muted">Книг в библиотеке</dt>
          <dd className="font-serif text-3xl">{books.length}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Закладок</dt>
          <dd className="font-serif text-3xl">{bookmarks.length}</dd>
        </div>
      </dl>
    </div>
  );
}
