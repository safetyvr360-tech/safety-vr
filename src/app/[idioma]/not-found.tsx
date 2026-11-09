'use client';

// Next no le pasa los parámetros a not-found: el idioma sale de la ruta.

import { usePathname } from 'next/navigation';
import { IDIOMA_POR_OMISION, idiomaDeRuta } from '../../i18n/idiomas.ts';
import { BotonEnlace } from '../../componentes/piezas.tsx';
import { textos } from '../textos.ts';

export default function NoEncontrada() {
  const idioma = idiomaDeRuta(usePathname() ?? '/') ?? IDIOMA_POR_OMISION;
  const t = textos(idioma);
  return (
    <section className="ancho portada">
      <span className="etiqueta">404</span>
      <h1>{t('web.no_encontrada.titulo')}</h1>
      <p>{t('web.no_encontrada.texto')}</p>
      <div className="acciones">
        <BotonEnlace href={`/${idioma}`} variante="primario">{t('web.no_encontrada.boton')}</BotonEnlace>
      </div>
    </section>
  );
}
