// Toda página vive bajo su idioma (/es-CO/… o /en/…). Una ruta sin idioma se
// redirige al que corresponda; una con idioma recuerda la elección en una cookie.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_IDIOMA, idiomaDeRuta, negociarIdioma, rutaEnIdioma } from './i18n/idiomas.ts';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const idioma = idiomaDeRuta(pathname);
  if (idioma !== null) {
    const res = NextResponse.next();
    if (req.cookies.get(COOKIE_IDIOMA)?.value !== idioma) {
      res.cookies.set(COOKIE_IDIOMA, idioma, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    }
    return res;
  }
  const elegido = negociarIdioma(req.headers.get('accept-language'), req.cookies.get(COOKIE_IDIOMA)?.value);
  return NextResponse.redirect(new URL(rutaEnIdioma(pathname + search, elegido), req.url));
}

export const config = {
  // Fuera: archivos internos de Next y cualquier archivo con extensión.
  matcher: ['/((?!_next/|.*\\.[\\w]+$).*)'],
};
