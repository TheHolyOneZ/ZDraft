import { useCallback } from "react";

import { useConfirmStore } from "../store/useConfirmStore";
import { Button, Modal } from "./ui";

export function ConfirmDialog() {
  const pending = useConfirmStore((s) => s.pending);
  const answer = useConfirmStore((s) => s.answer);

  const dismiss = useCallback(() => {
    const current = useConfirmStore.getState().pending;
    if (current) answer(current.dismiss);
  }, [answer]);

  return (
    <Modal
      open={pending !== null}
      onClose={dismiss}
      title={pending?.title ?? ""}
      width={460}
      footer={
        <div className="flex items-center justify-end gap-2">
          {pending?.choices.map((choice) => (
            <Button key={choice.id} variant={choice.variant} onClick={() => answer(choice.id)}>
              {choice.label}
            </Button>
          ))}
        </div>
      }
    >
      {pending?.body && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {pending.body}
        </p>
      )}
    </Modal>
  );
}
