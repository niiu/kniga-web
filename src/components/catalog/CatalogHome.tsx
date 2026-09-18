import { useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { BookOpen, Download, FolderOpen, PenLine, Server, Upload } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listPublishedBooks, publishBook, type PublishedBookMeta } from "@/lib/catalog/books.ts";
import { cn } from "@/lib/utils.ts";

interface Props {
  books: PublishedBookMeta[];
}

export function CatalogHome({ books: initial }: Props) {
  const router = useRouter();
  const [books, setBooks] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function ingest(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const file of list) {
        try {
          const text = await file.text();
          await publishBook({ data: { fileName: file.name, text } });
          ok += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Не удалось опубликовать файл";
          toast.error(`${file.name}: ${message}`);
        }
      }
      const next = await listPublishedBooks();
      setBooks(next);
      await router.invalidate();
      if (ok === 1) toast.success("Книга на сайте");
      else if (ok > 1) toast.success(`Опубликовано книг: ${ok}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5" strokeWidth={1.75} />
            <span className="font-display text-xl font-medium tracking-tight">Книга</span>
          </div>
          <Link
            to="/editor"
            preload="intent"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-accent hover:underline"
          >
            <PenLine className="size-4" />
            Мастерская
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 md:py-12">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight">Каталог</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Сюда публикуют готовые книги. Писать можно в мастерской или в десктопном редакторе —
            на сайт кладётся файл <span className="font-mono">.story</span> или HTML с маркером
            Книги. Случайные страницы не принимаются.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card p-5 md:p-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">Мастерская на компьютер</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Локальный редактор: пишете на своей машине, готовую книгу публикуете сюда. Windows —
            распакуйте архив и запустите «Установить.bat» или сразу Kniga.exe. Ubuntu — откройте
            .deb двойным щелчком или через установку приложений.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className={buttonVariants()} href="/downloads/Kniga-1.0.0-windows.zip" download>
              <Download className="size-4" />
              Windows
            </a>
            <a className={buttonVariants({ variant: "secondary" })} href="/downloads/kniga_1.0.0_amd64.deb" download>
              <Download className="size-4" />
              Ubuntu
            </a>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 md:p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-medium tracking-tight">
            <Server className="size-5" strokeWidth={1.75} />
            На свой сервер
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Сайт — каталог, мастерская и чтение. На Ubuntu с Docker:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-ink">
            {`git clone https://github.com/niiu/kniga-web.git
cd kniga-web
./deploy.sh
PORT=3000 ./deploy.sh`}
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Без PORT сайт на 8080. С <span className="font-mono">PORT=3000 ./deploy.sh</span> — на 3000.
            Каталог сохраняется в томе Docker. Репозиторий открытый:
            {" "}
            <a className="text-accent hover:underline" href="https://github.com/niiu/kniga-web">
              github.com/niiu/kniga-web
            </a>
            . Без Docker: Node 22, затем{" "}
            <span className="font-mono">npm ci && npm run build:server && npm start</span>.
            HTTPS — nginx из <span className="font-mono">deploy/nginx.conf</span>.
          </p>
        </section>

        <label
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) void ingest(e.dataTransfer.files);
          }}
          className={cn(
            "relative block cursor-pointer rounded-xl border border-dashed p-6 text-center transition-colors md:p-8",
            dragging ? "border-accent bg-muted" : "border-border bg-card",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".story,.json,.html,.htm,application/json,text/html"
            multiple
            disabled={busy}
            className="absolute inset-0 z-10 cursor-pointer opacity-0 file:hidden"
            onChange={(e) => {
              if (e.target.files?.length) void ingest(e.target.files);
              e.target.value = "";
            }}
          />
          <Upload className="mx-auto size-8" strokeWidth={1.5} />
          <p className="mt-3 font-display text-lg">Опубликовать книгу</p>
          <p className="mt-1 text-sm text-muted-foreground">
            HTML только с маркером KNIGA-ENGINE-v1
          </p>
          <span className={cn(buttonVariants(), "pointer-events-none relative z-0 mt-4 inline-flex")}>
            <FolderOpen className="size-4" />
            {busy ? "Публикация…" : "Выбрать файлы"}
          </span>
        </label>

        {books.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
            Пока пусто. Экспортируйте книгу из мастерской и перетащите файл сюда.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Опубликованные книги">
            {books.map((book) => (
              <li key={book.id}>
                <Link
                  to="/read/$bookId"
                  params={{ bookId: book.id }}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookOpen className="size-4 shrink-0" strokeWidth={1.75} />
                      <span className="truncate font-display text-lg font-medium">{book.title}</span>
                      <Badge>{book.source === "html" ? "HTML" : ".story"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-subtle">{book.sceneCount} сцен</p>
                  </div>
                  <span className="text-sm text-accent">Читать</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
