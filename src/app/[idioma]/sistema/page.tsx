import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { esIdioma } from '../../../i18n/idiomas.ts';
import { Boton, CampoCodigo, Pastilla, Tarjeta } from '../../../componentes/piezas.tsx';
import type { Estado } from '../../../componentes/piezas.tsx';
import { textos } from '../../textos.ts';

type Props = { params: Promise<{ idioma: string }> };

// Muestra de la fuente mono: un código de certificado como los que se emiten.
const CODIGO_MUESTRA = 'SVR-BYTZ-W54J-9VEQ';

const COLORES = ['fondo', 'panel', 'linea', 'tinta', 'tenue', 'seguridad', 'bien', 'medio', 'mal'] as const;
const ESTADOS: [string, Estado][] = [
  ['correcto', 'correcto'], ['parcial', 'parcial'], ['incorrecto', 'incorrecto'],
  ['vigente', 'correcto'], ['por_vencer', 'parcial'], ['vencido', 'incorrecto'], ['proximamente', 'neutro'],
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idioma } = await params;
  return esIdioma(idioma) ? { title: textos(idioma)('web.sistema.titulo') } : {};
}

export default async function Sistema({ params }: Props) {
  const { idioma } = await params;
  if (!esIdioma(idioma)) notFound();
  const t = textos(idioma);
  return (
    <>
      <section className="ancho portada">
        <h1>{t('web.sistema.titulo')}</h1>
        <p>{t('web.sistema.bajada')}</p>
      </section>

      <section className="ancho seccion" aria-labelledby="colores">
        <h2 id="colores">{t('web.sistema.colores')}</h2>
        <div className="rejilla">
          {COLORES.map((c) => (
            <div key={c} className="muestra-color">
              <div className="chip" style={{ background: `var(--${c})` }} />
              <span>{t(`web.color.${c}`)}</span>
              <code>{`--${c}`}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="ancho seccion" aria-labelledby="tipografia">
        <h2 id="tipografia">{t('web.sistema.tipografia')}</h2>
        {(['display', 'texto', 'mono'] as const).map((k) => (
          <div key={k} className="muestra-tipo">
            <span className="etiqueta">{t(`web.tipo.${k}`)}</span>
            <span className={k}>{k === 'mono' ? CODIGO_MUESTRA : t('web.tipo.muestra')}</span>
          </div>
        ))}
      </section>

      <section className="ancho seccion" aria-labelledby="botones">
        <h2 id="botones">{t('web.sistema.botones')}</h2>
        <div className="acciones">
          <Boton variante="primario">{t('web.boton.primario')}</Boton>
          <Boton>{t('web.boton.secundario')}</Boton>
          <Boton disabled>{t('web.boton.deshabilitado')}</Boton>
        </div>
      </section>

      <section className="ancho seccion" aria-labelledby="campos">
        <h2 id="campos">{t('web.sistema.campos')}</h2>
        <CampoCodigo id="codigo-visor" etiqueta={t('web.campo.codigo')} ayuda={t('web.campo.codigo.ayuda')} />
      </section>

      <section className="ancho seccion" aria-labelledby="estados">
        <h2 id="estados">{t('web.sistema.estados')}</h2>
        <div className="acciones">
          {ESTADOS.map(([clave, estado]) => <Pastilla key={clave} estado={estado}>{t(`web.estado.${clave}`)}</Pastilla>)}
        </div>
      </section>

      <section className="ancho seccion" aria-labelledby="tarjetas">
        <h2 id="tarjetas">{t('web.sistema.tarjetas')}</h2>
        <div className="rejilla">
          <Tarjeta>
            <h3>{t('web.sistema.tarjeta.titulo')}</h3>
            <p>{t('web.sistema.tarjeta.texto')}</p>
          </Tarjeta>
          <Tarjeta destacada>
            <span className="etiqueta">{t('web.color.seguridad')}</span>
            <h3>{t('web.tipo.muestra')}</h3>
            <div><Pastilla estado="correcto">{t('web.estado.vigente')}</Pastilla></div>
          </Tarjeta>
        </div>
      </section>
    </>
  );
}
