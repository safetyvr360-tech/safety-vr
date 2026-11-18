// La publicación en safetyvr.com.co: el trabajo «hosting» de GitHub Actions y los
// archivos que solo existen en ese servidor (comercial/hosting/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const flujo = readFileSync(`${raiz}.github/workflows/verificar-y-publicar.yml`, 'utf8');
const hosting = flujo.slice(flujo.indexOf('\n  hosting:'), flujo.indexOf('\n  publicar:'));

test('el hosting se publica solo desde main, después de verificar y con el mismo paquete de Pages', () => {
  assert.ok(hosting.length > 100, 'falta el trabajo hosting');
  assert.match(hosting, /if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/);
  assert.match(hosting, /needs: verificar/);
  assert.match(hosting, /name: github-pages/);
});

test('sin secretos no falla, y con ellos sube por FTP cifrado sin borrar nada', () => {
  assert.match(hosting, /if \[ -z "\$FTP_SERVIDOR" \] \|\| \[ -z "\$FTP_USUARIO" \] \|\| \[ -z "\$FTP_CLAVE" \]; then\n\s+echo "::notice::[^\n]*\n\s+exit 0\n\s+fi\n/);
  assert.match(hosting, /set ftp:ssl-force true; set ftp:ssl-protect-data true; set ssl:verify-certificate yes/);
  assert.ok(!/--delete|\brm -r[^\n]*\./.test(hosting.slice(hosting.indexOf('Subir a'))), 'la subida no borra en el servidor');
  assert.ok(!/echo[^\n]*\$FTP_(CLAVE|USUARIO)/.test(hosting), 'nunca imprime la clave ni el usuario');
});

test('al servidor van robots.txt y .htaccess, y no las carpetas del kit', () => {
  assert.match(hosting, /cp comercial\/hosting\/robots\.txt comercial\/hosting\/\.htaccess hosting\//);
  assert.match(hosting, /rm -rf hosting\/\.taste-skill/);
  assert.match(readFileSync(`${raiz}comercial/hosting/robots.txt`, 'utf8'), /^Sitemap: https:\/\/safetyvr\.com\.co\/sitemap\.xml$/m);
});

test('el .htaccess lleva a https y sin www, y manda las cabeceras de seguridad', () => {
  const h = readFileSync(`${raiz}comercial/hosting/.htaccess`, 'utf8');
  assert.match(h, /RewriteCond %\{HTTPS\} !=on[\s\S]*RewriteRule \^ https:\/\/%\{HTTP_HOST\}%\{REQUEST_URI\} \[L,R=301\]/);
  assert.match(h, /RewriteCond %\{HTTP_HOST\} \^www\\.\(\.\+\)\$ \[NC\]/);
  assert.match(h, /Options -Indexes/);
  for (const c of ['X-Content-Type-Options "nosniff"', 'X-Frame-Options "SAMEORIGIN"', 'Referrer-Policy "strict-origin-when-cross-origin"']) assert.ok(h.includes(c), c);
});

test('después de subir, compara cada página publicada con la que se armó', () => {
  assert.match(hosting, /for ruta in "" inversion\/ legal\/ en\/ en\/investors\/ en\/legal\/; do/);
  assert.match(hosting, /test "\$local" = "\$vivo"/);
});
