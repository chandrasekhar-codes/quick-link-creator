import QRCode from "qrcode";

export type ErrorLevel = "L" | "M" | "Q" | "H";

/** Max bytes a QR code can hold at level L (version 40, byte mode). */
export const QR_MAX_BYTES = 2900;
/** Files up to this size are embedded directly as a base64 data URI. */
export const EMBED_MAX_BYTES = 1200;

export function pickErrorLevel(data: string): ErrorLevel {
  const len = new TextEncoder().encode(data).length;
  if (len <= 120) return "H";
  if (len <= 400) return "Q";
  if (len <= 900) return "M";
  return "L";
}

export function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value) || /^(mailto|tel):/i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

export function isValidUrl(raw: string): boolean {
  const candidate = normalizeUrl(raw);
  if (!candidate) return false;
  try {
    const url = new URL(candidate);
    if (url.protocol === "mailto:" || url.protocol === "tel:") return true;
    return /^[^\s.]+\.[^\s.]{2,}$/.test(url.hostname) || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function toPngDataUrl(data: string, size: number, level: ErrorLevel) {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: level,
    width: size,
    margin: 2,
    color: { dark: "#0b1220", light: "#ffffff" },
  });
}

export async function toSvgString(data: string, size: number, level: ErrorLevel) {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: level,
    width: size,
    margin: 2,
    color: { dark: "#0b1220", light: "#ffffff" },
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}
