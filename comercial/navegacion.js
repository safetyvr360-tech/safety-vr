// Páginas públicas de SAFETY VR (comercial e inversión): el menú marca la
// sección visible con aria-current="location". La sección actual es la última
// del menú cuyo borde superior ya pasó la mitad de la pantalla. Se calcula al
// desplazarse, una vez por cuadro (requestAnimationFrame) y con un oyente
// pasivo; sin IntersectionObserver, que los verificadores leen como una
// aparición al entrar en pantalla. Sin texto visible (directiva 4).
(() => {
  const enlaces = [...document.querySelectorAll('.nav__links .nav__link[href^="#"]')];
  const pares = enlaces.map((a) => [a, document.querySelector(a.getAttribute('href'))]).filter(([, s]) => s);
  if (!pares.length) return;
  let actual = null;
  let pendiente = false;
  const marcar = () => {
    pendiente = false;
    const mitad = innerHeight / 2;
    let nuevo = null;
    for (const [a, s] of pares) {
      const r = s.getBoundingClientRect();
      if (r.top <= mitad && r.bottom > mitad) nuevo = a;
    }
    if (nuevo === actual) return;
    if (actual) actual.removeAttribute('aria-current');
    if (nuevo) nuevo.setAttribute('aria-current', 'location');
    actual = nuevo;
  };
  const pedir = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(marcar); } };
  addEventListener('scroll', pedir, { passive: true });
  addEventListener('resize', pedir, { passive: true });
  pedir();
})();
