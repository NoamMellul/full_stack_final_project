"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// D-03: this password exists in exactly one place after the API response —
// here, in component state, for the life of this dialog. It is never
// written to storage, never placed in the URL, and dropped (via the parent
// clearing its own state on close) the moment the dialog closes.
export default function TempPasswordDialog({
  open,
  password,
  doctorName,
  onClose,
}: {
  open: boolean;
  password: string;
  doctorName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login created</DialogTitle>
          <DialogDescription>A login account was created for {doctorName}.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="font-mono text-sm font-semibold">{`Temporary password: ${password}`}</p>

          <Button type="button" variant="outline" onClick={handleCopy} className="w-fit">
            {copied ? "Copied" : "Copy password"}
          </Button>

          <p className="text-sm font-medium text-destructive">
            This password will not be shown again. Share it with the doctor now.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              setCopied(false);
              onClose();
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
