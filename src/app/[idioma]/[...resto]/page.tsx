// Cualquier ruta que no exista bajo un idioma muestra la página de «no
// encontrada» de ese idioma, no la genérica en inglés de Next.

import { notFound } from 'next/navigation';

export default function NoExiste() {
  notFound();
}
