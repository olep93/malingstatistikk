import { appPath } from './base-path';
import type { PdfImageSource } from './print-pdf';

export async function loadPrintPdfFonts() {
  const fonts = await Promise.all(['Regular', 'Bold'].map(async weight => {
    const response = await fetch(appPath(`/fonts/NotoSans-${weight}.ttf`), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Kunne ikke klargjøre rapporten. Prøv igjen.');
    return new Uint8Array(await response.arrayBuffer());
  }));
  return { regular: fonts[0], bold: fonts[1] };
}

async function fetchImage(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok || !(response.headers.get('content-type') || '').startsWith('image/')) throw new Error('Bilde utilgjengelig');
  const blob = await response.blob();
  if (blob.size > 5 * 1024 * 1024) throw new Error('Bilde for stort');
  if (/image\/(png|jpeg)/.test(blob.type) && blob.size < 512 * 1024) return new Uint8Array(await blob.arrayBuffer());
  // Convert WebP/SVG and oversized assets into an embedded PNG, including in Safari.
  const image = new Image();
  const objectUrl = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Bilde utilgjengelig')); image.src = objectUrl; });
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Bilde utilgjengelig');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Bilde utilgjengelig')), 'image/png'));
    return new Uint8Array(await png.arrayBuffer());
  } finally { URL.revokeObjectURL(objectUrl); }
}

export async function loadPrintPdfImage(source: PdfImageSource): Promise<Uint8Array | undefined> {
  if (!source.product) return fetchImage(appPath('/logos/obsbygg.png')).catch(() => undefined);
  const row = source.product;
  if (row.image) {
    try { return await fetchImage(appPath(row.image)); } catch { /* Use the authenticated same-origin image endpoint if the source does not allow CORS. */ }
  }
  const query = new URLSearchParams({ product: row.product, supplier: row.supplier, size: row.size || '', ean: row.ean || '', itemNo: row.itemNo || '', key: row.productKey || '', embed: '1' });
  return fetchImage(appPath(`/api/product-image?${query}`)).catch(() => undefined);
}
