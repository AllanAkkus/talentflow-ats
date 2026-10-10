"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Destructive action behind a confirmation dialog.
 *
 * The submit happens inside a real <form> posting to a server action, so the
 * delete still runs through the same auth + organization checks as everything
 * else. `hiddenFields` carries the record id.
 */
export function ConfirmSubmit({
  action,
  hiddenFields,
  triggerLabel,
  title,
  description,
  confirmLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="danger" size="md" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        widthClassName="max-w-md"
      >
        <p className="text-sm text-slate-600">{description}</p>
        <form action={action} className="mt-5 flex items-center gap-2">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <SubmitButton variant="danger" pendingLabel="Deleting...">
            {confirmLabel}
          </SubmitButton>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      </Dialog>
    </>
  );
}
