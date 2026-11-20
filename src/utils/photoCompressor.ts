export interface CompressedPhotoResult {
  dataUrl: string;
  blob: Blob;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  mimeType: string;
}

export async function compressPhotoFile(
  file: File,
  maxDimension = 1400,
  quality = 0.78
): Promise<CompressedPhotoResult> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('File bukan gambar yang dapat diproses.'));
    image.src = dataUrl;
  });

  let targetWidth = img.width;
  let targetHeight = img.height;
  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
      targetHeight = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D tidak tersedia di browser ini.');
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const outputMime = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const compressedDataUrl = canvas.toDataURL(outputMime, quality);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal mengompresi foto.'))),
      outputMime,
      quality
    );
  });

  return {
    dataUrl: compressedDataUrl,
    blob,
    originalBytes: file.size,
    compressedBytes: blob.size,
    width: targetWidth,
    height: targetHeight,
    mimeType: outputMime,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
