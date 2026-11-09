import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANES, TRM_REFERENCIA, aUSD, formatoCOP, formatoMillones, formatoPorcentaje, formatoUSD, formatoUSDMillones, preciosDe } from './precios.ts';

test('las cifras grandes van en millones con un decimal, según el idioma', () => {
  assert.equal(formatoMillones(10_800_000, 'es-CO'), '$10,8 M');
  assert.equal(formatoMillones(10_800_000, 'en'), 'COP 10.8 M');
  assert.equal(formatoMillones(70_000_000, 'es-CO'), '$70 M');
  assert.equal(formatoMillones(11_340_000_000, 'es-CO'), '$11.340 M');
});

test('los dólares grandes van en millones: el mercado de Barranquilla es USD 2,6 M', () => {
  assert.equal(formatoUSDMillones(aUSD(11_340_000_000), 'es-CO'), 'USD 2,6 M');
  assert.equal(formatoUSDMillones(aUSD(11_340_000_000), 'en'), 'USD 2.6 M');
});

test('los porcentajes llevan un decimal y el espacio que pide el español', () => {
  assert.equal(formatoPorcentaje(0.329, 'es-CO'), '32,9 %');
  assert.equal(formatoPorcentaje(0.329, 'en'), '32.9%');
  assert.equal(formatoPorcentaje(5 / 700, 'es-CO'), '0,7 %');
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
  assert.equal(formatoCOP(450_000, 'es-CO'), '$450.000');
  assert.equal(formatoCOP(1_350_000, 'en'), 'COP 1,350,000');
  assert.equal(formatoUSD(1239, 'es-CO'), 'USD 1.239');
  assert.equal(formatoUSD(1239, 'en'), 'USD 1,239');
});

test('el precio anual es doce meses, en las dos monedas', () => {
  assert.deepEqual(preciosDe('piloto', 'es-CO'), { mes_cop: '$450.000', mes_usd: 'USD 103', anio_cop: '$5.400.000', anio_usd: 'USD 1.239' });
  assert.deepEqual(preciosDe('corporativo', 'en'), { mes_cop: 'COP 3,600,000', mes_usd: 'USD 826', anio_cop: 'COP 43,200,000', anio_usd: 'USD 9,908' });
});
