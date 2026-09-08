import { Group as GroupIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { adapterFor, useDocumentStore } from "../store/useDocumentStore";
import { toast } from "../store/useToastStore";
import { Button, Modal, TextInput } from "./ui";


export function GroupDialog({
  open,
  onClose,
  ids,
}: {
  open: boolean;
  onClose(): void;
  ids: readonly string[];
}) {
  const engine = useDocumentStore((s) => s.engine);
  const groupNodes = useDocumentStore((s) => s.groupNodes);

  const [title, setTitle] = useState("");
  useEffect(() => {
    if (open) setTitle("");
  }, [open]);

  const supported = Boolean(adapterFor(engine).edit?.group);
  const trimmed = title.trim();

  const create = () => {
    if (trimmed === "") return;

    if (groupNodes(ids, trimmed)) {
      toast.success(`Grouped ${ids.length} node${ids.length === 1 ? "" : "s"}`, trimmed);
      onClose();
    } else {
      toast.error("Could not group these", "This engine has no container ZDraft can write.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Group into a container"
      description={
        supported
          ? `${ids.length} node${ids.length === 1 ? "" : "s"}. This writes your source file — the nodes stay exactly where they are declared and the container claims them by name.`
          : "This engine has no container ZDraft can write."
      }
      width={440}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create} disabled={!supported || trimmed === ""}>
            <GroupIcon size={13} strokeWidth={1.75} />
            Group
          </Button>
        </div>
      }
    >
      <TextInput
        value={title}
        onChange={setTitle}
        placeholder="Edge tier"
        autoFocus
        onSubmit={create}
        hint="The label drawn on the box."
      />
    </Modal>
  );
}
