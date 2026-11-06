import { Button } from "@/components/ui/button";
import { hasStartUpdates, startCopyAction, type StartCopyAction } from "@/lib/kniga/startObject.ts";
import { cn } from "@/lib/utils.ts";

interface Props {
  title: string;
  emptyText: string;
  sources: Record<string, number>;
  starting: Record<string, number>;
  onApply: (entries: Record<string, number>) => void;
}

const ACTION_LABEL: Record<StartCopyAction, string> = {
  add: "Взять",
  update: "Обновить",
  same: "В старте",
};

const ACTION_TITLE: Record<StartCopyAction, string> = {
  add: "Взять в стартовый объект",
  update: "Обновить в стартовом объекте",
  same: "Уже в стартовом объекте",
};

export function StartValuePicker({ title, emptyText, sources, starting, onApply }: Props) {
  const entries = Object.entries(sources).filter(([, value]) => Number.isFinite(value));
  const canTakeAll = hasStartUpdates(starting, sources);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink-subtle">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-subtle">{emptyText}</p>
      ) : (
        <>
          <p className="text-xs text-ink-subtle">
            Нажмите, чтобы скопировать значение в стартовый объект.
          </p>
          <div className="flex flex-wrap gap-1">
            {entries.map(([name, value]) => {
              const action = startCopyAction(starting, name, value);
              return (
                <button
                  key={name}
                  type="button"
                  title={ACTION_TITLE[action]}
                  aria-label={`${ACTION_TITLE[action]}: ${name} ${value}`}
                  disabled={action === "same"}
                  className={cn(
                    "rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground",
                    action === "same" && "border-transparent bg-muted text-ink-subtle",
                    action === "update" && "border-accent",
                  )}
                  onClick={() => onApply({ [name]: value })}
                >
                  {name} <span className="tabular-nums">{value}</span>
                  {" · "}
                  {ACTION_LABEL[action]}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={!canTakeAll}
            onClick={() => onApply(sources)}
          >
            Взять все
          </Button>
        </>
      )}
    </div>
  );
}
