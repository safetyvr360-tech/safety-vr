// Directiva 4 en la app web: ningún texto visible escrito en un .tsx. Todo
// sale de mensajes/*.json. Se lee el árbol sintáctico de TypeScript (no
// expresiones regulares): falla con texto entre etiquetas JSX o con un
// atributo visible (aria-label, title, alt, placeholder) escrito a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const CARPETAS = ['src/app', 'src/componentes'];
const ATRIBUTOS_VISIBLES = new Set(['aria-label', 'title', 'alt', 'placeholder', 'label']);
const tieneLetras = (s: string) => /\p{L}/u.test(s);

function archivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivosTsx(r) : r.endsWith('.tsx') ? [r] : [];
  });
}

export function textosCrudos(nombre: string, fuente: string): string[] {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hallados: string[] = [];
  const linea = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visitar = (n: ts.Node): void => {
    if (ts.isJsxText(n) && tieneLetras(n.text)) hallados.push(`${nombre}:${linea(n)} «${n.text.trim()}»`);
    if (ts.isJsxAttribute(n) && ATRIBUTOS_VISIBLES.has(n.name.getText(sf))) {
      const v = n.initializer;
      const literal = v && ts.isStringLiteral(v) ? v : v && ts.isJsxExpression(v) && v.expression && ts.isStringLiteral(v.expression) ? v.expression : null;
      if (literal && tieneLetras(literal.text)) hallados.push(`${nombre}:${linea(n)} ${n.name.getText(sf)}="${literal.text}"`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return hallados;
}

test('ningún componente de la app trae texto visible escrito a mano', () => {
  const archivos = CARPETAS.flatMap((c) => archivosTsx(join(raiz, c)));
  assert.ok(archivos.length >= 5, `se esperaban los .tsx de la app (${archivos.length})`);
  const hallados = archivos.flatMap((a) => textosCrudos(a.slice(raiz.length), readFileSync(a, 'utf8')));
  assert.deepEqual(hallados, []);
});

test('el detector ve texto entre etiquetas y en atributos visibles', () => {
  assert.equal(textosCrudos('x.tsx', 'const a = <p>Hola</p>;').length, 1);
  assert.equal(textosCrudos('x.tsx', 'const a = <a aria-label="Inicio" />;').length, 1);
  assert.equal(textosCrudos('x.tsx', 'const a = <img alt={"Casco"} />;').length, 1);
});

test('el detector no confunde código, números ni clases con texto', () => {
  assert.deepEqual(textosCrudos('x.tsx', 'const a = <p className="btn primario">{t("k")}</p>;'), []);
  assert.deepEqual(textosCrudos('x.tsx', 'const a = <span>404</span>;'), []);
  assert.deepEqual(textosCrudos('x.tsx', 'type R = Record<Idioma, string>; const b = x > y && y < z;'), []);
});
