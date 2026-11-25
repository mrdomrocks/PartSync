"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedItem } from "@/lib/labels";

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const handled = useRef(false);
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState("Open the camera and point it at a PartSync label.");
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  function openCode(raw: string) {
    if (handled.current) return;
    const id = parseScannedItem(raw);
    if (!id) {
      setMessage("That code isn’t a PartSync item. Hold the label steady in the frame.");
      return;
    }
    handled.current = true;
    controlsRef.current?.stop();
    router.push(`/items/${id}/take`);
  }

  async function startLiveCamera() {
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) return false;
    setMessage("Opening the camera.");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    video.srcObject = stream;
    await video.play();
    const { BrowserQRCodeReader } = await import("@zxing/browser");
    const controls = await new BrowserQRCodeReader().decodeFromStream(
      stream,
      video,
      (result, _error, active) => {
        if (!result || handled.current) return;
        const id = parseScannedItem(result.getText());
        if (!id) {
          setMessage("That code isn’t a PartSync item. Hold the label steady in the frame.");
          return;
        }
        handled.current = true;
        active.stop();
        router.push(`/items/${id}/take`);
      },
    );
    controlsRef.current = controls;
    setLive(true);
    setMessage("Point the camera at a PartSync label.");
    return true;
  }

  async function openCamera() {
    if (handled.current) return;
    if (window.isSecureContext && navigator.mediaDevices?.getUserMedia) {
      try {
        const started = await startLiveCamera();
        if (started) return;
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setMessage("The camera is blocked. Allow the camera for this site, then tap Open camera again.");
          return;
        }
        if (name === "NotFoundError" || name === "OverconstrainedError") {
          setMessage("No camera was found on this device.");
          return;
        }
      }
    }
    setMessage(
      "The live scanner needs the https address. This button opens the camera so you can photograph the label.",
    );
    photoRef.current?.click();
  }

  async function onPhoto(file: File) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageElement(image);
      openCode(result.getText());
    } catch {
      setMessage("No PartSync code was in that photo. Move closer and try again.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        {live ? (
          <div className="pointer-events-none absolute inset-[12%] rounded-lg border-2 border-white/80" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Button type="button" className="h-12 px-5 text-base" onClick={() => void openCamera()}>
              Open camera
            </Button>
          </div>
        )}
      </div>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onPhoto(file);
        }}
      />
      <p className="text-sm leading-6 text-muted-foreground" role="status">
        {message}
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          openCode(pasted);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pasted-code">Or paste a PartSync link</Label>
          <Input
            id="pasted-code"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder="http://192.168.1.20:4747/items/…"
            className="h-11 text-base"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 px-4">
          Open that item
        </Button>
      </form>
    </div>
  );
}
