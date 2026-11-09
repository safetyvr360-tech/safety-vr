// Piezas del sistema de diseño. Ninguna trae texto propio: todo llega ya
// traducido desde mensajes/*.json (directiva 4).

import type { ReactNode } from 'react';
import Link from 'next/link';

type Variante = 'primario' | 'secundario';

export function Boton(props: { children: ReactNode; variante?: Variante; disabled?: boolean; type?: 'button' | 'submit' }) {
  const clase = props.variante === 'primario' ? 'btn primario' : 'btn';
  return <button type={props.type ?? 'button'} className={clase} disabled={props.disabled}>{props.children}</button>;
}

// Un enlace con aspecto de botón. Los externos abren en la misma pestaña: el
// visor del Quest no maneja bien pestañas nuevas.
export function BotonEnlace(props: { children: ReactNode; href: string; variante?: Variante }) {
  const clase = props.variante === 'primario' ? 'btn primario' : 'btn';
  if (/^https?:/.test(props.href)) return <a className={clase} href={props.href}>{props.children}</a>;
  return <Link className={clase} href={props.href}>{props.children}</Link>;
}

export function Tarjeta(props: { children: ReactNode; destacada?: boolean }) {
  return <article className={props.destacada ? 'tarjeta destacada' : 'tarjeta'}>{props.children}</article>;
}

export type Estado = 'correcto' | 'parcial' | 'incorrecto' | 'neutro';

export function Pastilla(props: { estado: Estado; children: ReactNode }) {
  return <span className={`pastilla ${props.estado}`}>{props.children}</span>;
}

// Campo para el código de emparejamiento del visor: solo dígitos, teclado
// numérico en el teléfono y sin autocorrección.
export function CampoCodigo(props: { id: string; etiqueta: string; ayuda: string }) {
  const ayudaId = `${props.id}-ayuda`;
  return (
    <div className="campo">
      <label htmlFor={props.id}>{props.etiqueta}</label>
      <input id={props.id} name={props.id} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} aria-describedby={ayudaId} />
      <span className="ayuda" id={ayudaId}>{props.ayuda}</span>
    </div>
  );
}
