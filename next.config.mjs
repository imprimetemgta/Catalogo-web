/** @type {import('next').NextConfig} */
const nextConfig = {
  // Metadata siempre en <head>, sin streaming: Next 15 la manda al <body> en las
  // páginas dinámicas y Chrome ignora ahí el <link rel="manifest">, así que la
  // app no se podía instalar. Nuestra metadata es fija: no retrasa nada.
  htmlLimitedBots: /.*/,
};
export default nextConfig;
