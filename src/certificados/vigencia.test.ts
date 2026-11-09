import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diasEntre, estadoVigencia, fechaCivil, sumarMeses } from './vigencia.ts';

test('la fecha civil es la de Colombia, no la de UTC', () => {
  // 31 de enero, 9 p. m. en Bogotá = 1 de febrero, 2 a. m. UTC.
  assert.equal(fechaCivil(Date.UTC(2026, 1, 1, 2, 0)), '2026-01-31');
  assert.equal(fechaCivil(Date.UTC(2026, 1, 1, 6, 0)), '2026-02-01');
});

test('sumar meses respeta el fin de mes', () => {
  assert.equal(sumarMeses('2026-11-08', 12), '2027-11-08');
  assert.equal(sumarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(sumarMeses('2028-01-31', 1), '2028-02-29', 'año bisiesto');
  assert.equal(sumarMeses('2028-02-29', 12), '2029-02-28');
  assert.equal(sumarMeses('2026-12-15', 1), '2027-01-15');
  assert.equal(sumarMeses('2026-05-31', 0), '2026-05-31');
});

test('fechas o meses imposibles se rechazan', () => {
  assert.throws(() => sumarMeses('2026-02-30', 1), /fecha_invalida/);
  assert.throws(() => sumarMeses('08/11/2026', 1), /fecha_invalida/);
  assert.throws(() => sumarMeses('2026-01-01', -1), /meses_invalidos/);
  assert.throws(() => sumarMeses('2026-01-01', 1.5), /meses_invalidos/);
});

test('días entre fechas, también cruzando años bisiestos', () => {
  assert.equal(diasEntre('2026-11-08', '2026-11-09'), 1);
  assert.equal(diasEntre('2028-02-28', '2028-03-01'), 2);
  assert.equal(diasEntre('2026-11-09', '2026-11-08'), -1);
});

test('vigente, por vencer (30 días) y vencido; el último día todavía es vigente', () => {
  const hasta = '2027-11-08';
  assert.equal(estadoVigencia(hasta, '2027-10-08'), 'vigente', 'faltan 31 días');
  assert.equal(estadoVigencia(hasta, '2027-10-01'), 'vigente');
  assert.equal(estadoVigencia(hasta, '2027-10-09'), 'por_vencer');
  assert.equal(estadoVigencia(hasta, '2027-11-08'), 'por_vencer', 'el último día cuenta');
  assert.equal(estadoVigencia(hasta, '2027-11-09'), 'vencido');
  assert.equal(diasEntre('2027-10-08', hasta), 31);
});

test('el aviso de vencimiento es configurable', () => {
  assert.equal(estadoVigencia('2027-11-08', '2027-09-01', 90), 'por_vencer');
  assert.equal(estadoVigencia('2027-11-08', '2027-09-01', 30), 'vigente');
});
