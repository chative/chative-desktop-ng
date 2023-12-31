import { canvasToBlob } from './canvasToBlob';
import type { MIMEType } from '../types/MIME';

export async function canvasToBytes(
  canvas: HTMLCanvasElement,
  mimeType?: MIMEType,
  quality?: number
): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, mimeType, quality);
  return new Uint8Array(await blob.arrayBuffer());
}
