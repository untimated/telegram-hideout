import { drawNewsIllustration } from './models/newspaper-art.js';

const pictures = new Map();
const printDots = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Work on a small canvas once, then reuse it for both the paper texture and reader.
export function processNewsPhoto(image, { zoom = 1, focusX = .5, focusY = .5 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const context = canvas.getContext('2d');
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.max(canvas.width / width, canvas.height / height) * zoom;
  const cropWidth = canvas.width / scale;
  const cropHeight = canvas.height / scale;
  const left = Math.max(0, Math.min(width - cropWidth, width * focusX - cropWidth / 2));
  const top = Math.max(0, Math.min(height - cropHeight, height * focusY - cropHeight / 2));
  context.drawImage(image, left, top,
    cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  let seed = 91;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const x = (index / 4) % canvas.width;
    const y = Math.floor(index / 4 / canvas.width);
    const luminance = .2126 * pixels.data[index] + .7152 * pixels.data[index + 1] + .0722 * pixels.data[index + 2];
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const grain = (seed / 4294967296 - .5) * .025;
    const dots = (printDots[(y % 4) * 4 + x % 4] - 7.5) / 255;
    const tone = Math.max(0, Math.min(1, (luminance / 255 - .5) * 1.15 + .5 + dots + grain));
    // Dark brown ink through to warm paper, without losing photographic detail.
    pixels.data[index] = 49 + tone * 184;
    pixels.data[index + 1] = 42 + tone * 179;
    pixels.data[index + 2] = 35 + tone * 161;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function getNewsPicture(article) {
  if (pictures.has(article.id)) return pictures.get(article.id);
  const picture = { canvas: drawNewsIllustration(article.illustration), isPhoto: false };
  let dataURL;
  picture.url = () => dataURL ??= picture.canvas.toDataURL('image/png');
  pictures.set(article.id, picture);
  picture.ready = new Promise(resolve => {
    if (!article.photo || typeof Image !== 'function') { resolve(false); return; }
    const image = new Image();
    let settled = false;
    const finish = success => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      resolve(success);
    };
    const timeout = setTimeout(() => finish(false), 8000);
    image.onload = () => {
      try {
        picture.canvas = processNewsPhoto(image, article.photo);
        picture.isPhoto = true;
        dataURL = undefined;
        finish(true);
      } catch { finish(false); } // Decode or canvas/CORS failure keeps the original drawing.
    };
    image.onerror = () => finish(false);
    image.crossOrigin = 'anonymous';
    image.src = article.photo.src;
  });
  return picture;
}
