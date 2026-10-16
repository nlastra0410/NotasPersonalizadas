import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeExportFileName, buildPrintHtml } from './exportUtils.ts';

test('sanitizeExportFileName strips problematic characters and sets extension', () => {
  assert.equal(sanitizeExportFileName('Mi Nota #1: Ideas!!', 'png'), 'mi_nota_1_ideas.png');
  assert.equal(sanitizeExportFileName('   ', 'pdf'), 'documento.pdf');
  assert.equal(sanitizeExportFileName('Diagrama de Flujo (V1.0)', 'png'), 'diagrama_de_flujo_v1_0.png');
});

test('buildPrintHtml generates valid HTML document with embedded image and styling', () => {
  const html = buildPrintHtml('Nota de Prueba', 'data:image/png;base64,abc1234', 'Texto transcrito');
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>Nota de Prueba - Nota Scribe</title>'));
  assert.ok(html.includes('src="data:image/png;base64,abc1234"'));
  assert.ok(html.includes('Texto transcrito'));
  assert.ok(html.includes('@page'));
});
