import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  FileUp,
  Link2,
  Loader2,
  QrCode,
  ScanLine,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  EMBED_MAX_BYTES,
  QR_MAX_BYTES,
  formatBytes,
  isValidUrl,
  normalizeUrl,
  pickErrorLevel,
  readFileAsDataUrl,
  toPngDataUrl,
  toSvgString,
} from "@/lib/qr-utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QR Forge — QR Codes for Text, Links & Files" },
      {
        name: "description",
        content:
          "Create scannable QR codes from text, links or any file. Small files embed offline, big files get a shareable link. Download PNG or SVG.",
      },
      { property: "og:title", content: "QR Forge — QR Codes for Text, Links & Files" },
      {
        property: "og:description",
        content:
          "Live QR preview, smart error correction, file hosting for large uploads, PNG and SVG downloads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Mode = "text" | "link" | "file";
type FileResult = { kind: "embedded" | "hosted"; data: string; name: string; size: number };

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const TABS: { id: Mode; label: string; icon: typeof TypeIcon }[] = [
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "link", label: "Link", icon: Link2 },
  { id: "file", label: "File", icon: FileUp },
];

function Index() {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("Scan me — made with QR Forge");
  const [url, setUrl] = useState("");
  const [size, setSize] = useState(320);

  const [fileResult, setFileResult] = useState<FileResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [png, setPng] = useState<string>("");
  const [svg, setSvg] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);

  const payload = useMemo(() => {
    if (mode === "text") return text.trim();
    if (mode === "link") return isValidUrl(url) ? normalizeUrl(url) : "";
    return fileResult?.data ?? "";
  }, [mode, text, url, fileResult]);

  const urlInvalid = mode === "link" && url.trim().length > 0 && !isValidUrl(url);
  const byteLength = useMemo(() => new TextEncoder().encode(payload).length, [payload]);
  const level = useMemo(() => pickErrorLevel(payload), [payload]);
  const tooLong = byteLength > QR_MAX_BYTES;

  useEffect(() => {
    let active = true;
    if (!payload || tooLong) {
      setPng("");
      setSvg("");
      setRenderError(tooLong ? "This content is too long to fit in a QR code." : null);
      return;
    }
    console.log("qr effect", payload.length, size, level);
    (async () => {
      try {

        const [pngData, svgData] = await Promise.all([
          toPngDataUrl(payload, size, level),
          toSvgString(payload, size, level),
        ]);
        if (!active) return;
        setPng(pngData);
        setSvg(svgData);
        setRenderError(null);
      } catch (e) {
        console.error("qr render failed", e);
        if (active) setRenderError("Could not build a QR code from this content.");
      }
    })();
    return () => {
      active = false;
    };
  }, [payload, size, level, tooLong]);

  const handleFile = useCallback(async (file: File) => {
    setFileError(null);
    setFileResult(null);

    if (file.size === 0) {
      setFileError("That file is empty.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError(`That file is ${formatBytes(file.size)} — the limit is 50 MB.`);
      return;
    }

    setUploading(true);
    try {
      if (file.size <= EMBED_MAX_BYTES) {
        const dataUri = await readFileAsDataUrl(file);
        if (new TextEncoder().encode(dataUri).length <= QR_MAX_BYTES) {
          setFileResult({ kind: "embedded", data: dataUri, name: file.name, size: file.size });
          setUploading(false);
          return;
        }
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("qr-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.storage
        .from("qr-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (error || !data?.signedUrl) throw error ?? new Error("No link returned");

      setFileResult({ kind: "hosted", data: data.signedUrl, name: file.name, size: file.size });
    } catch (err) {
      console.error(err);
      setFileError("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  const downloadPng = () => {
    if (!png) return;
    const a = document.createElement("a");
    a.href = png;
    a.download = "qr-code.png";
    a.click();
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(href);
  };

  const copyImage = async () => {
    if (!png) return;
    try {
      const blob = await (await fetch(png)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("QR image copied to clipboard");
    } catch {
      toast.error("Your browser blocked copying images. Use Download instead.");
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <Toaster />

      <header className="mb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <QrCode className="h-3.5 w-3.5 text-primary" /> Text · Links · Any file
        </span>
        <h1 className="mt-5 text-4xl font-bold sm:text-5xl">QR Forge</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Turn anything into a QR code that native phone cameras open instantly. Tiny files ride
          inside the code itself; bigger ones get a shareable link.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Input panel */}
        <section className="panel p-5 sm:p-7">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  aria-pressed={active}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4">
            {mode === "text" && (
              <div className="space-y-2">
                <Label htmlFor="qr-text">Your text</Label>
                <Textarea
                  id="qr-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Type anything — a note, wifi password, a poem…"
                />
                <p className="text-xs text-muted-foreground">
                  {byteLength} / {QR_MAX_BYTES} characters used
                </p>
              </div>
            )}

            {mode === "link" && (
              <div className="space-y-2">
                <Label htmlFor="qr-url">Website address</Label>
                <Input
                  id="qr-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com/page"
                  aria-invalid={urlInvalid}
                />
                {urlInvalid ? (
                  <p className="text-xs text-destructive">
                    That doesn&apos;t look like a valid address yet.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {url.trim()
                      ? `Will open: ${normalizeUrl(url)}`
                      : "No https:// needed — we add it for you."}
                  </p>
                )}
              </div>
            )}

            {mode === "file" && (
              <div className="space-y-3">
                <Label htmlFor="qr-file">Upload a file</Label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleFile(file);
                  }}
                  className="rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-8 text-center"
                >
                  <FileUp className="mx-auto h-6 w-6 text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Drag a file here, or choose one below
                  </p>
                  <input
                    id="qr-file"
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-4"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Working…
                      </>
                    ) : (
                      "Choose file"
                    )}
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground">
                    PDF, TXT, DOCX, images and more · up to 50 MB
                  </p>
                </div>

                {fileError && (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {fileError}
                  </p>
                )}

                {fileResult && (
                  <div className="rounded-xl border border-border bg-secondary/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{fileResult.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatBytes(fileResult.size)} ·{" "}
                          {fileResult.kind === "embedded"
                            ? "stored inside the QR code (works offline)"
                            : "uploaded — the QR opens a shareable link"}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove file"
                        onClick={() => {
                          setFileResult(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <span
                      className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        fileResult.kind === "embedded"
                          ? "bg-success/15 text-success"
                          : "bg-accent/15 text-accent"
                      }`}
                    >
                      {fileResult.kind === "embedded" ? "Embedded" : "Hosted link"}
                    </span>
                    {fileResult.kind === "hosted" && (
                      <p className="mt-3 break-all text-xs text-muted-foreground">
                        {fileResult.data}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <Label htmlFor="qr-size">QR size</Label>
                <span className="text-xs text-muted-foreground">
                  {size} × {size} px
                </span>
              </div>
              <Slider
                id="qr-size"
                min={128}
                max={1024}
                step={32}
                value={[size]}
                onValueChange={([v]) => setSize(v ?? 320)}
              />
              <p className="text-xs text-muted-foreground">
                Error correction: level {level} (chosen automatically for this content)
              </p>
            </div>
          </div>
        </section>

        {/* Preview panel */}
        <section className="panel flex flex-col items-center p-5 sm:p-7">
          <h2 className="self-start text-lg font-semibold">Live preview</h2>

          <div className="mt-5 flex w-full flex-1 items-center justify-center">
            {png ? (
              <img
                src={png}
                alt="Generated QR code preview"
                className="glow w-full max-w-[320px] rounded-2xl bg-white p-3"
              />
            ) : (
              <div className="flex aspect-square w-full max-w-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">
                <QrCode className="h-8 w-8 opacity-40" />
                <p className="max-w-[220px]">
                  {renderError ?? "Your QR code appears here as you type or upload."}
                </p>
              </div>
            )}
          </div>

          {png && (
            <p className="mt-4 text-xs text-muted-foreground">
              {byteLength} bytes encoded · level {level}
            </p>
          )}

          <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <Button onClick={downloadPng} disabled={!png}>
              <Download className="h-4 w-4" /> PNG
            </Button>
            <Button variant="secondary" onClick={downloadSvg} disabled={!svg}>
              <Download className="h-4 w-4" /> SVG
            </Button>
            <Button variant="outline" onClick={copyImage} disabled={!png}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>

          <div className="mt-6 flex w-full items-start gap-3 rounded-xl border border-border bg-secondary/60 p-4">
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Test scan tip:</span> open the normal
              camera app on an iPhone or Android phone and hold it about 20 cm from the screen. A
              tap-through banner should appear within a second. If nothing shows, increase the QR
              size or shorten the content.
            </p>
          </div>
        </section>
      </div>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Files under {formatBytes(EMBED_MAX_BYTES)} are embedded directly in the code; larger ones are
        stored securely and shared with a private link valid for one year.
      </footer>
    </main>
  );
}
