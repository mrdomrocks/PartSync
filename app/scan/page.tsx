import Link from "next/link";
import { QrScanner } from "@/components/qr-scanner";
import { PageIntro } from "@/components/page-intro";

export const metadata = {
  title: "Scan",
};

export default function ScanPage() {
  return (
    <>
      <PageIntro
        eyebrow="Shelf label"
        title="Scan a label"
        lede="Tap Open camera and hold the label in the frame. PartSync opens that item so you can take it out of stock."
      />
      <QrScanner />
      <p className="mt-6 text-sm">
        <Link href="/" className="underline underline-offset-4">
          Back to parts
        </Link>
      </p>
    </>
  );
}
