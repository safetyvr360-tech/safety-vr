'use client';

// Las partes de la barra que dependen de la ruta actual: el enlace activo y el
// selector de idioma, que lleva a la misma página en el otro idioma.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IDIOMAS, rutaEnIdioma } from '../i18n/idiomas.ts';
import type { Idioma } from '../motor/presentador.ts';

export function EnlaceNav(props: { href: string; texto: string }) {
  const actual = usePathname();
  return <Link href={props.href} aria-current={actual === props.href ? 'page' : undefined}>{props.texto}</Link>;
}

export function SelectorIdioma(props: { idioma: Idioma; etiqueta: string; cortos: Record<Idioma, string>; nombres: Record<Idioma, string> }) {
  const actual = usePathname() ?? '/';
  return (
    <nav className="idioma" aria-label={props.etiqueta}>
      {IDIOMAS.map((i) => (
        <Link key={i} href={rutaEnIdioma(actual, i)} hrefLang={i} lang={i} aria-label={props.nombres[i]} aria-current={i === props.idioma ? 'true' : undefined}>
          {props.cortos[i]}
        </Link>
      ))}
    </nav>
  );
}
