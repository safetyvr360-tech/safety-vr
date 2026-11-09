import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { IDIOMAS, esIdioma } from '../../i18n/idiomas.ts';
import { EnlaceNav, SelectorIdioma } from '../../componentes/navegacion.tsx';
import { textos } from '../textos.ts';
import { DEMO } from '../enlaces.ts';
import '../../componentes/sistema.css';

const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--fuente-display', display: 'swap' });
const texto = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--fuente-texto', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--fuente-mono', display: 'swap' });

// Solo existen /es-CO y /en, y se generan de antemano. No se usa
// `dynamicParams = false`: bloquearía también la ruta comodín [...resto] y la
// 404 propia de cada idioma. El middleware ya garantiza que el primer segmento
// sea un idioma válido.
export function generateStaticParams() {
  return IDIOMAS.map((idioma) => ({ idioma }));
}

type Props = { params: Promise<{ idioma: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idioma } = await params;
  if (!esIdioma(idioma)) return {};
  const t = textos(idioma);
  return {
    title: { default: t('web.marca'), template: `%s · ${t('web.marca')}` },
    description: t('web.meta.descripcion'),
    alternates: { languages: Object.fromEntries(IDIOMAS.map((i) => [i, `/${i}`])) },
  };
}

export default async function Plantilla({ children, params }: Props & { children: ReactNode }) {
  const { idioma } = await params;
  if (!esIdioma(idioma)) notFound();
  const t = textos(idioma);
  return (
    <html lang={idioma} className={`${display.variable} ${texto.variable} ${mono.variable}`}>
      <body>
        <a className="saltar" href="#contenido">{t('web.saltar')}</a>
        <header className="barra">
          <div className="ancho">
            <Link className="marca" href={`/${idioma}`}>
              <span className="franja" aria-hidden="true" />
              <b>{t('web.marca')}</b>
            </Link>
            <nav className="nav">
              <EnlaceNav href={`/${idioma}`} texto={t('web.nav.inicio')} />
              <EnlaceNav href={`/${idioma}/sistema`} texto={t('web.nav.sistema')} />
              <a href={DEMO}>{t('web.nav.demo')}</a>
            </nav>
            <SelectorIdioma
              idioma={idioma}
              etiqueta={t('web.idioma.etiqueta')}
              cortos={{ 'es-CO': t('web.idioma.es'), en: t('web.idioma.en') }}
              nombres={{ 'es-CO': t('web.idioma.es_nombre'), en: t('web.idioma.en_nombre') }}
            />
          </div>
        </header>
        <main id="contenido">{children}</main>
        <footer className="pie">
          <div className="ancho">{t('web.pie.derechos', { anio: new Date().getFullYear() })}</div>
        </footer>
      </body>
    </html>
  );
}
