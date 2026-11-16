"use client";

// Downscale photos before upload: phone cameras produce 5-15 MB images. The scan model reads
// images up to 2576px on the long edge (~3.75 MP), and the grid is often only part of the photo,
// so keep close to that: at 1000px a grid filling half a newspaper photo had cells ~50px wide,
// which is where printed digits start getting misread. Stays well under Vercel's 4.5 MB body limit.

const SCAN_EDGE = 2400;
const SCAN_MAX_PIXELS = 3_600_000;
const PREVIEW_EDGE = 1000;
const THUMB_EDGE = 160;

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function render(src: CanvasImageSource & { width: number; height: number }, maxEdge: number, quality: number, maxPixels = Infinity): string {
  const scale = Math.min(1, maxEdge / Math.max(src.width, src.height), Math.sqrt(maxPixels / (src.width * src.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(src.width * scale);
  canvas.height = Math.round(src.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export interface PreparedImage {
  base64: string;
  mediaType: "image/jpeg";
  previewUrl: string;
  thumbnail: string;
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const src = await decode(file);
  const scan = render(src, SCAN_EDGE, 0.9, SCAN_MAX_PIXELS);
  const previewUrl = render(src, PREVIEW_EDGE, 0.85);
  return {
    base64: scan.slice(scan.indexOf(",") + 1),
    mediaType: "image/jpeg",
    previewUrl,
    thumbnail: render(src, THUMB_EDGE, 0.6),
  };
}
