import type { ActionState } from "@/lib/types";

export function StatusNote({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p role="status" className="text-sm leading-6 text-olive">
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm leading-6 text-destructive">
      {state.error}
    </p>
  );
}
