"use client";

// Downscale photos before upload: phone cameras produce 5-15 MB images, but
// ~1000px on the long edge leaves each sudoku cell ~100px wide, plenty for
// reading printed digits. Vision cost scales with pixel area, so this halves it.

const MAX_EDGE = 1000;
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

function render(src: CanvasImageSource & { width: number; height: number }, maxEdge: number, quality: number): string {
  const scale = Math.min(1, maxEdge / Math.max(src.width, src.height));
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
  const previewUrl = render(src, MAX_EDGE, 0.88);
  return {
    base64: previewUrl.slice(previewUrl.indexOf(",") + 1),
    mediaType: "image/jpeg",
    previewUrl,
    thumbnail: render(src, THUMB_EDGE, 0.6),
  };
}
