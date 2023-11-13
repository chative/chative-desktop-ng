import { IMAGE_JPEG } from '../types/MIME';

/**
 * Similar to [the built-in `toBlob` method][0], but returns a Promise.
 *
 * [0]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType = IMAGE_JPEG,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      result => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Couldn't convert the canvas to a Blob"));
        }
      },
      mimeType,
      quality
    )
  );
}
