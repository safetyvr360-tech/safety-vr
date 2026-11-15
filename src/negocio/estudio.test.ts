import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANIO_RECUPERACION, BENEFICIO_COSTO, FINANCIACION, INGRESOS, INVERSION_INICIAL, SIMULADORES, TIR, UTILIDAD_NETA, VALOR_ACTUAL, VPN,
  fondoEmprender, ingresosAnio,
} from './estudio.ts';

// Cada cifra contra la hoja «Estudio Viabilidad Financiera» del estudio de Ultramedia360.

test('la financiación suma el 100 % y el Fondo Emprender pone $53,7 M de los $137,7 M', () => {
  assert.equal(Math.round((FINANCIACION.aporte_equipos + FINANCIACION.fondo_emprender) * 100), 100);
  assert.equal(Math.round(fondoEmprender() / 100_000) / 10, 53.7);
  assert.equal(Math.round(INVERSION_INICIAL / 100_000) / 10, 137.7);
});

test('los ingresos suman $226,5 M el año 1 y $316,2 M el año 5, y crecen todos los años', () => {
  assert.equal(Math.round(ingresosAnio(1) / 100_000) / 10, 226.5);
  assert.equal(Math.round(ingresosAnio(5) / 100_000) / 10, 316.2);
  for (let a = 2; a <= 5; a++) assert.ok(ingresosAnio(a) > ingresosAnio(a - 1), `el año ${a} no crece`);
  for (const [linea, anios] of Object.entries(INGRESOS)) {
    for (let a = 1; a < 5; a++) assert.ok(anios[a]! > anios[a - 1]!, `${linea} no crece en el año ${a + 1}`);
  }
});

test('los simuladores del año 1 son 3 proyectos de $30 M: $90 M, la línea más grande después de drones', () => {
  assert.equal(SIMULADORES.proyectos_anio * SIMULADORES.precio, INGRESOS.simuladores[0]);
  assert.ok(SIMULADORES.precio > SIMULADORES.costo, 'el simulador se vende por encima de su costo');
  assert.equal(Math.round((INGRESOS.simuladores[0] / ingresosAnio(1)) * 100), 40);
});

test('el VPN es el valor actual menos la inversión, y los indicadores dicen «viable»', () => {
  assert.ok(Math.abs(VALOR_ACTUAL - INVERSION_INICIAL - VPN) < 2, 'VPN = VA − inversión');
  assert.ok(TIR > 0.12, 'la TIR supera el costo de capital');
  assert.ok(BENEFICIO_COSTO > 1);
  assert.equal(ANIO_RECUPERACION, 3);
  assert.ok(UTILIDAD_NETA.anio1 > 0 && UTILIDAD_NETA.anio5 > UTILIDAD_NETA.anio1);
});
