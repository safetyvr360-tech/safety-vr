// Páginas públicas de SAFETY VR (comercial e inversión): el menú marca la
// sección visible con aria-current="location". Un IntersectionObserver mira una
// franja en el centro de la pantalla; la última sección del menú que la cruza
// es la actual. Sin texto visible (directiva 4).
(() => {
  const enlaces = [...document.querySelectorAll('.nav__links .nav__link[href^="#"]')];
  const pares = enlaces.map((a) => [a, document.querySelector(a.getAttribute('href'))]).filter(([, s]) => s);
  if (!pares.length || !('IntersectionObserver' in window)) return;
  const visibles = new Set();
  const marcar = () => {
    const actual = pares.filter(([, s]) => visibles.has(s)).pop();
    for (const [a] of pares) a.removeAttribute('aria-current');
    if (actual) actual[0].setAttribute('aria-current', 'location');
  };
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target);
    marcar();
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const [, s] of pares) obs.observe(s);
})();
