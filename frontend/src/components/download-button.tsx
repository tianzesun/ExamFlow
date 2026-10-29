"use client";

import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { downloadFile, errorReference } from "@/lib/api/client";
import { Button } from "./button";

interface DownloadButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  url: string;
  /** Used when the server doesn't name the file */
  filename: string;
}

/** A button that downloads an authenticated file (PDFs, packages). */
export function DownloadButton({ url, filename, children, ...props }: DownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...props}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadFile(url, filename);
        } catch (err) {
          toast.error(`The download couldn't be prepared. Try again.${errorReference(err)}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </Button>
  );
}
