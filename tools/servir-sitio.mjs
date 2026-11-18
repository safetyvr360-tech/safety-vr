// Sirve sitio/ en http://localhost:4180 para revisarlo en el navegador antes de publicar.
// Uso: node tools/servir-sitio.mjs [carpeta] [puerto]   (npm run servir)
// Sin dependencias; solo lee archivos dentro de la carpeta.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

// La ruta pedida, dentro de la carpeta; null si intenta salir de ella.
export function rutaSegura(raiz, url) {
  const limpia = decodeURIComponent(url.split(/[?#]/)[0]);
  const destino = resolve(raiz, '.' + normalize('/' + limpia));
  return destino === raiz || destino.startsWith(raiz + sep) ? destino : null;
}

export function servir(carpeta, puerto) {
  const raiz = resolve(carpeta);
  return createServer(async (pedido, respuesta) => {
    let ruta = rutaSegura(raiz, pedido.url ?? '/');
    try {
      if (!ruta) throw new Error('fuera');
      if ((await stat(ruta)).isDirectory()) ruta = join(ruta, 'index.html');
      const cuerpo = await readFile(ruta);
      respuesta.writeHead(200, { 'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      respuesta.end(cuerpo);
    } catch {
      respuesta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      respuesta.end('404');
    }
  }).listen(puerto);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const carpeta = process.argv[2] ?? join(fileURLToPath(new URL('..', import.meta.url)), 'sitio');
  const puerto = Number(process.env.PORT ?? process.argv[3] ?? 4180); // PORT: el que asigne quien lo arranque
  servir(carpeta, puerto);
  console.log(`sitio/ en http://localhost:${puerto}/`);
}
