import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { RotateCcw, AlertTriangle } from "lucide-react";
export function ResetDialog({ onReset }: { onReset: () => Promise<void> }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError("");
      }}
    >
      <AlertDialog.Trigger asChild>
        <button className="text-button">
          <RotateCcw size={14} /> Reset my demo
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <div className="dialog-symbol">
            <AlertTriangle size={24} />
          </div>
          <AlertDialog.Title>Reset your demo workspace?</AlertDialog.Title>
          <AlertDialog.Description>
            Your imported records, review tasks and notes in this browser
            session will be removed. The original synthetic portfolio will be
            restored.
          </AlertDialog.Description>
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <AlertDialog.Cancel asChild>
              <button className="secondary" disabled={busy}>
                Keep my work
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                disabled={busy}
                onClick={async (e) => {
                  e.preventDefault();
                  setError("");
                  setBusy(true);
                  try {
                    await onReset();
                    setOpen(false);
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Reset could not complete. Please try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Resetting…" : "Reset workspace"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
