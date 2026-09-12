# Quick Link Creator

Build a fully functional, single-page QR code generator website with the following features:

Core Input Types

Text: any plain text string

URL/Link: auto-detect and validate URLs, prefix with https:// if missing

File upload: accept PDF, TXT, DOCX, images, etc.

File Handling Logic (important — QR codes can only hold ~2–3KB of data):

For small text-based files (TXT, small PDFs under size limit): read file content, base64-encode it, and embed directly in the QR as a data URI so it works offline

For larger files (most PDFs, images, DOCX): upload the file to temporary/cloud storage (e.g., a simple backend endpoint, or a free file-hosting API), generate a shareable public link, and encode that link in the QR — this is the realistic approach for "any file, any size"

Clearly show the user which mode was used (embedded vs. hosted link) and the resulting file size

QR Generation

Use a reliable library (e.g., qrcode.js or qrcode-generator)

Auto-select appropriate error correction level based on data size

Show a live preview as the user types/uploads

Support adjustable QR size and downloadable formats (PNG, SVG)

Scannability

Test that generated codes open correctly on both iOS and Android native camera apps (not just dedicated QR apps)

Include a "Test Scan" preview tip in the UI

UI/UX

Clean, responsive, mobile-friendly layout

Tabs or toggle for input type: Text / Link / File

Download button + "Copy Image" option

Error handling: invalid URLs, oversized files, unsupported formats

Tech stack: Plain HTML/CSS/JS (or React) — no heavy frameworks needed for this scope.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35cddeeb-2f20-4c9c-a88e-f5bc291e1aab).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
