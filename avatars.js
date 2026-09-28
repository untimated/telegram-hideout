// Downloads stay on the server: Telegram file URLs contain the bot token.
export function createAvatarLoader({ botToken, telegramAPIBase, fetchImpl, now }) {
  const cache = new Map();
  const maxBytes = 2 * 1024 * 1024;

  async function load(userID, signedPhotoURL) {
    async function api(method, body) {
      const response = await fetchImpl(`${telegramAPIBase}/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Telegram photo lookup failed');
      const result = await response.json();
      if (!result.ok) throw new Error('Telegram photo lookup rejected');
      return result.result;
    }

    async function download(url) {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok || Number(response.headers.get('content-length')) > maxBytes || !response.body) {
        throw new Error('Telegram photo download failed');
      }
      const chunks = [];
      let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > maxBytes) throw new Error('Telegram photo too large');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      // Detect actual raster bytes. Never serve HTML/SVG returned by an upstream.
      const type = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' :
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' :
        bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
      if (!type) throw new Error('Unsupported Telegram photo');
      return { bytes, type };
    }

    let botError;
    try {
      const profile = await api('getUserProfilePhotos', { user_id: Number(userID), limit: 1 });
      const sizes = profile.photos?.[0];
      if (sizes?.length) {
        const photo = [...sizes].sort((a, b) => a.width - b.width).find(size => size.width >= 160) ?? sizes.at(-1);
        const file = await api('getFile', { file_id: photo.file_id });
        const path = file.file_path;
        if (typeof path !== 'string' || !/^[\w/-]+\.(jpg|jpeg|png|webp)$/i.test(path) ||
            path.startsWith('/') || file.file_size > maxBytes) throw new Error('Invalid Telegram photo file');
        return await download(`${telegramAPIBase}/file/bot${botToken}/${path}`);
      }
    } catch (error) {
      botError = error;
    }

    // Telegram may include a signed photo_url even when the Bot API has no
    // accessible profile photo. Proxy only Telegram-owned HTTPS hosts.
    if (signedPhotoURL) {
      try {
        const url = new URL(signedPhotoURL);
        if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
            !/^(?:[\w-]+\.)*(?:t\.me|telegram\.org|telegram-cdn\.org)$/.test(url.hostname)) {
          throw new Error('Invalid Telegram photo URL');
        }
        return await download(url.href);
      } catch {
        // Keep the normal initials fallback when the signed URL is unavailable.
      }
    }
    if (botError) throw botError;
    return null;
  }

  return {
    get(userID, signedPhotoURL) {
      const entry = cache.get(userID);
      if (entry && entry.expires > now()) return entry.promise;
      // Cache misses/errors briefly too, so multiple viewers cannot fan out requests.
      const next = { expires: now() + 60, promise: null };
      next.promise = load(userID, signedPhotoURL).then(photo => {
        next.expires = now() + (photo ? 300 : 60);
        return photo;
      });
      cache.set(userID, next);
      return next.promise;
    },
    remove(userID) { cache.delete(userID); },
  };
}
