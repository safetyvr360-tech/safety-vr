import { esIdioma } from '../../i18n/idiomas.ts';
import { notFound } from 'next/navigation';
import { BotonEnlace, Pastilla, Tarjeta } from '../../componentes/piezas.tsx';
import { textos } from '../textos.ts';
import { DEMO } from '../enlaces.ts';

const PORTALES = ['trabajador', 'empresa', 'proveedor', 'operacion'] as const;

export default async function Inicio({ params }: { params: Promise<{ idioma: string }> }) {
  const { idioma } = await params;
  if (!esIdioma(idioma)) notFound();
  const t = textos(idioma);
  return (
    <>
      <section className="ancho portada">
        <h1>{t('web.inicio.titulo')}</h1>
        <p>{t('web.inicio.bajada')}</p>
      </section>
      <section className="ancho seccion" aria-labelledby="portales">
        <h2 id="portales">{t('web.inicio.portales')}</h2>
        <div className="rejilla cuatro">
          {PORTALES.map((p) => (
            <Tarjeta key={p}>
              <h3>{t(`web.portal.${p}.titulo`)}</h3>
              <p>{t(`web.portal.${p}.texto`)}</p>
              <div><Pastilla estado="neutro">{t('web.estado.proximamente')}</Pastilla></div>
            </Tarjeta>
          ))}
        </div>
      </section>
      <section className="ancho seccion">
        <Tarjeta destacada>
          <h2>{t('web.inicio.demo.titulo')}</h2>
          <p>{t('web.inicio.demo.texto')}</p>
          <div className="acciones">
            <BotonEnlace href={DEMO} variante="primario">{t('web.inicio.demo.boton')}</BotonEnlace>
          </div>
        </Tarjeta>
      </section>
    </>
  );
}
