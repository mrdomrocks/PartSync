"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedItem } from "@/lib/labels";

const insecureCopy =
  "The camera stays off on a plain network address. Use the phone’s own camera on the printed label, or open this page on this machine.";

function subscribe() {
  return () => {};
}

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const handled = useRef(false);
  const secure = useSyncExternalStore(
    subscribe,
    () => window.isSecureContext,
    () => null as boolean | null,
  );
  const [message, setMessage] = useState("Looking for a PartSync label.");
  const [pasted, setPasted] = useState("");

  function openCode(raw: string) {
    if (handled.current) return;
    const id = parseScannedItem(raw);
    if (!id) {
      setMessage("That code isn’t a PartSync item.");
      return;
    }
    handled.current = true;
    router.push(`/items/${id}/take`);
  }

  useEffect(() => {
    if (secure !== true) return;
    const video = videoRef.current;
    if (!video) return;

    let stopped = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (stopped) return;
        const reader = new BrowserQRCodeReader();
        const next = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result, _error, active) => {
            if (!result || handled.current) return;
            const id = parseScannedItem(result.getText());
            if (!id) {
              setMessage("That code isn’t a PartSync item.");
              return;
            }
            handled.current = true;
            active.stop();
            router.push(`/items/${id}/take`);
          },
        );
        if (stopped) {
          next.stop();
          return;
        }
        controls = next;
      } catch (error) {
        if (stopped) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setMessage("The camera is blocked. Allow it for this site, or paste the link from the code.");
        } else if (name === "NotFoundError") {
          setMessage("No camera was found on this device. Paste the link from the code instead.");
        } else {
          setMessage("The camera didn’t start. Paste the link from the code instead.");
        }
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [router, secure]);

  return (
    <div className="max-w-lg space-y-4">
      {secure === true ? (
        <video
          ref={videoRef}
          className="aspect-square w-full rounded-xl bg-black object-cover"
          muted
          playsInline
          autoPlay
        />
      ) : null}
      <p className="text-sm leading-6 text-muted-foreground" role="status">
        {secure === false ? insecureCopy : message}
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          openCode(pasted);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pasted-code">Paste a PartSync link</Label>
          <Input
            id="pasted-code"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder="http://192.168.1.20:4747/items/…"
            className="h-11 text-base"
            autoComplete="off"
          />
        </div>
        <Button type="submit" className="h-11 px-4">
          Open that item
        </Button>
      </form>
    </div>
  );
}
