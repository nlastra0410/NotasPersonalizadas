import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTasksFromText,
  calculateTaskStats,
  sortTasks,
} from './taskManager.ts';
import type { TaskItem } from './taskManager.ts';

test('extractTasksFromText extracts checkboxes and bullet points', () => {
  const text = `
Mis Tareas de Hoy:
- [ ] Enviar reporte al equipo
- [x] Comprar repuestos de stylus
* Revisar diseño de la tablet
1. Terminar mapa conceptual
  `.trim();

  const tasks = extractTasksFromText(text, 'high');
  assert.equal(tasks.length, 4);
  assert.equal(tasks[0].text, 'Enviar reporte al equipo');
  assert.equal(tasks[0].completed, false);
  assert.equal(tasks[1].text, 'Comprar repuestos de stylus');
  assert.equal(tasks[1].completed, true);
  assert.equal(tasks[2].text, 'Revisar diseño de la tablet');
  assert.equal(tasks[3].text, 'Terminar mapa conceptual');
});

test('calculateTaskStats computes totals and percentage', () => {
  const tasks: TaskItem[] = [
    { id: '1', text: 'T1', completed: true, priority: 'medium', createdAt: 1 },
    { id: '2', text: 'T2', completed: false, priority: 'medium', createdAt: 2 },
    { id: '3', text: 'T3', completed: true, priority: 'high', createdAt: 3 },
    { id: '4', text: 'T4', completed: false, priority: 'low', createdAt: 4 },
  ];

  const stats = calculateTaskStats(tasks);
  assert.equal(stats.total, 4);
  assert.equal(stats.completed, 2);
  assert.equal(stats.pending, 2);
  assert.equal(stats.percent, 50);
});

test('sortTasks places uncompleted before completed, and high priority before low', () => {
  const tasks: TaskItem[] = [
    { id: '1', text: 'Hecho Alta', completed: true, priority: 'high', createdAt: 1 },
    { id: '2', text: 'Pendiente Baja', completed: false, priority: 'low', createdAt: 2 },
    { id: '3', text: 'Pendiente Alta', completed: false, priority: 'high', createdAt: 3 },
  ];

  const sorted = sortTasks(tasks);
  // Pendiente Alta should be first
  assert.equal(sorted[0].id, '3');
  // Pendiente Baja second
  assert.equal(sorted[1].id, '2');
  // Completed last
  assert.equal(sorted[2].id, '1');
});
