import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANES, TRM_REFERENCIA, aUSD, formatoCOP, formatoMillones, formatoPorcentaje, formatoUSD, formatoUSDMillones, preciosDe } from './precios.ts';

// Las cifras llevan espacio que no se parte (U+00A0); para leer las pruebas se comparan con espacios normales.
const NB = String.fromCharCode(160);
const sin = (x: string) => x.split(NB).join(' ');
const sinTodo = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, sin(v)]));

test('ninguna cifra con unidad lleva un espacio que se pueda partir', () => {
  for (const x of [formatoCOP(1_350_000, 'en'), formatoUSD(1239, 'es-CO'), formatoMillones(10_800_000, 'es-CO'), formatoMillones(10_800_000, 'en'), formatoUSDMillones(2_600_917, 'en'), formatoPorcentaje(0.329, 'es-CO')]) {
    assert.ok(!x.includes(' '), `«${x}» tiene un espacio normal`);
  }
  assert.ok(formatoUSD(103, 'en').includes(NB));
});

test('las cifras grandes van en millones con un decimal, según el idioma', () => {
  assert.equal(sin(formatoMillones(10_800_000, 'es-CO')), '$10,8 M');
  assert.equal(sin(formatoMillones(10_800_000, 'en')), 'COP 10.8 M');
  assert.equal(sin(formatoMillones(70_000_000, 'es-CO')), '$70 M');
  assert.equal(sin(formatoMillones(11_340_000_000, 'es-CO')), '$11.340 M');
});

test('los dólares grandes van en millones: el mercado de Barranquilla es USD 2,6 M', () => {
  assert.equal(sin(formatoUSDMillones(aUSD(11_340_000_000), 'es-CO')), 'USD 2,6 M');
  assert.equal(sin(formatoUSDMillones(aUSD(11_340_000_000), 'en')), 'USD 2.6 M');
});

test('los porcentajes llevan un decimal y el espacio que pide el español', () => {
  assert.equal(sin(formatoPorcentaje(0.329, 'es-CO')), '32,9 %');
  assert.equal(sin(formatoPorcentaje(0.329, 'en')), '32.9%');
  assert.equal(sin(formatoPorcentaje(5 / 700, 'es-CO')), '0,7 %');
});

test('los planes son los del modelo financiero', () => {
  assert.deepEqual(PLANES, { piloto: 450_000, planta: 1_350_000, corporativo: 3_600_000 });
  assert.equal(TRM_REFERENCIA, 4360);
});

test('los dólares salen de la TRM de referencia, redondeados al dólar', () => {
  assert.equal(aUSD(450_000), 103); // 103,21
  assert.equal(aUSD(1_350_000), 310); // 309,63
  assert.equal(aUSD(3_600_000), 826); // 825,69
});

test('los pesos se escriben como en Colombia y, en inglés, sin un «$» que parezca dólar', () => {
  assert.equal(sin(formatoCOP(450_000, 'es-CO')), '$450.000');
  assert.equal(sin(formatoCOP(1_350_000, 'en')), 'COP 1,350,000');
  assert.equal(sin(formatoUSD(1239, 'es-CO')), 'USD 1.239');
  assert.equal(sin(formatoUSD(1239, 'en')), 'USD 1,239');
});

test('el precio anual es doce meses, en las dos monedas', () => {
  assert.deepEqual(sinTodo(preciosDe('piloto', 'es-CO')), { mes_cop: '$450.000', mes_usd: 'USD 103', anio_cop: '$5.400.000', anio_usd: 'USD 1.239' });
  assert.deepEqual(sinTodo(preciosDe('corporativo', 'en')), { mes_cop: 'COP 3,600,000', mes_usd: 'USD 826', anio_cop: 'COP 43,200,000', anio_usd: 'USD 9,908' });
});
