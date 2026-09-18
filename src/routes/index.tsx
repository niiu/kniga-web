import { createFileRoute } from "@tanstack/react-router";
import { CatalogHome } from "@/components/catalog/CatalogHome";
import { listPublishedBooks } from "@/lib/catalog/books.ts";

export const Route = createFileRoute("/")({
  loader: () => listPublishedBooks(),
  component: Home,
});

function Home() {
  const books = Route.useLoaderData();
  return <CatalogHome books={books} />;
}
