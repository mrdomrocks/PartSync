import QRCode from "qrcode";

export async function qrSvg(value: string): Promise<string> {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 1,
    width: 280,
    color: { dark: "#171717", light: "#ffffff" },
  });
  return svg.replace(/^\s*<\?xml[^>]*>\s*/i, "");
}
