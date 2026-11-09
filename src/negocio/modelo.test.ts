import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPITAL_SEMILLA, EBITDA_ANIO1, METAS, USO_DE_FONDOS, mercadoDireccionable, mesQueCubreElFijo, mrrPorMes,
  penetracionMeta, suscripcionDirectaAnio, ticketAnual, totalIngresos,
} from './modelo.ts';

// Cada cifra contra la que dice SAFETYVR-modelo-financiero.md.

test('el calendario de clientes da la suscripción directa del documento: $31,5 M', () => {
  assert.equal(suscripcionDirectaAnio(), 31_500_000);
});

test('el ingreso recurrente llega a $10,8 M en el mes 12 y es $2,25 M en el mes 7', () => {
  const m = mrrPorMes();
  assert.equal(m.length, 12);
  assert.equal(m[11], 10_800_000);
  assert.equal(m[6], 2_250_000);
  assert.deepEqual(m.slice(0, 3), [0, 0, 0], 'nadie paga antes del mes 4');
  for (let i = 1; i < 12; i++) assert.ok(m[i]! >= m[i - 1]!, 'el recurrente no baja: nadie cancela en el modelo');
});

test('el recurrente cubre el costo fijo en el mes 7', () => {
  assert.equal(mesQueCubreElFijo(), 7);
});

test('los ingresos del año 1 suman $118,9 M y el margen EBITDA es 32,9 %', () => {
  assert.equal(totalIngresos(), 118_900_000);
  assert.equal(Math.round((EBITDA_ANIO1 / totalIngresos()) * 1000) / 10, 32.9);
});

test('el uso de fondos suma exactamente el capital semilla', () => {
  assert.equal(USO_DE_FONDOS.reduce((s, [, v]) => s + v, 0), CAPITAL_SEMILLA);
  assert.equal(CAPITAL_SEMILLA, 20_000_000);
});

test('el mercado direccionable es 700 × $16,2 M = $11.340 M y la meta es 0,7 %', () => {
  assert.equal(ticketAnual(), 16_200_000);
  assert.equal(mercadoDireccionable(), 11_340_000_000);
  assert.equal(Math.round(penetracionMeta() * 1000) / 10, 0.7);
});

test('los módulos del año 1 son las 10 apps nativas más 4 escenarios nuevos', () => {
  assert.equal(METAS.apps_nativas + METAS.escenarios_webxr, METAS.modulos);
});
