import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "@/components/kniga/EditorShell";
import { AppErrorComponent } from "@/lib/error-component";

export const Route = createFileRoute("/editor")({
  component: EditorPage,
  pendingComponent: EditorPending,
  errorComponent: AppErrorComponent,
});

function EditorPending() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
      <p className="font-display text-lg text-ink">Мастерская…</p>
    </div>
  );
}

function EditorPage() {
  return <EditorShell />;
}
