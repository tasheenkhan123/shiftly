'use client';

/**
 * Shrinks an image in the browser before it is sent or stored.
 * Phone screenshots are often 3–8 MB; a 1280px JPEG is ~150–300 KB and is plenty for Gemini
 * to read product names and logos. Smaller uploads = faster searches.
 */
export async function downscaleImage(source: File | Blob | string, maxDim = 1280, quality = 0.85): Promise<string> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image.'));
      el.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image.');
    ctx.fillStyle = '#ffffff'; // transparent PNGs -> white background instead of black
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}
