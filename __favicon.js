const sharp = require('sharp');
const path = require('path');

const SRC = String.raw`C:\Users\User\.claude\uploads\8c91feeb-45fa-4efb-a67c-6fb9345abe3f\7784d1bc-image.png`;
const OUT_TRIMMED = path.join('public', 'favicon-imprimete-trim-debug.png');
const OUT_FINAL = path.join('public', 'favicon-imprimete.png');

(async () => {
  // 1) Recorte al bounding box real del icono (quita el margen blanco).
  const trimmed = sharp(SRC).trim();
  const trimmedBuf = await trimmed.png().toBuffer();
  await sharp(trimmedBuf).toFile(OUT_TRIMMED);
  const meta = await sharp(trimmedBuf).metadata();
  console.log('trimmed dims:', meta.width, 'x', meta.height);

  // 2) Blanco -> transparente (para que se vea bien en pestañas oscuras),
  // usando distancia de color simple sobre los px cercanos a blanco puro.
  const { data, info } = await sharp(trimmedBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  const UMBRAL = 18; // qué tan cerca de blanco puro para volverse transparente
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i], g = out[i + 1], b = out[i + 2];
    const distBlanco = 255 - Math.min(r, g, b);
    if (distBlanco <= UMBRAL) {
      out[i + 3] = 0;
    }
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(OUT_FINAL);

  const finalMeta = await sharp(OUT_FINAL).metadata();
  console.log('final dims:', finalMeta.width, 'x', finalMeta.height, 'hasAlpha:', finalMeta.hasAlpha);
})().catch((e) => { console.error(e); process.exit(1); });
