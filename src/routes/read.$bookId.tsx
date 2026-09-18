import { createFileRoute, Link } from "@tanstack/react-router";
import { CatalogPlayer } from "@/components/catalog/CatalogPlayer";
import { getPublishedBook } from "@/lib/catalog/books.ts";
import { normalizeLoadedStory } from "@/lib/kniga/gameEngine.ts";

export const Route = createFileRoute("/read/$bookId")({
  loader: ({ params }) => getPublishedBook({ data: { id: params.bookId } }),
  component: ReadPage,
});

function ReadPage() {
  const data = Route.useLoaderData();
  let story;
  try {
    story = normalizeLoadedStory(JSON.parse(data.storyJson));
  } catch {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-muted-foreground">Не удалось прочитать книгу.</p>
        <Link to="/" className="mt-4 inline-block text-accent hover:underline">
          К каталогу
        </Link>
      </main>
    );
  }
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <CatalogPlayer story={story} />
    </div>
  );
}
