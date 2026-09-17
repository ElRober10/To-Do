import { describe, it, expect } from 'vitest';
import { priorityLabel, priorityWeight } from '../../frontend/utils/priority.js';

describe('priority utils', () => {
  /** Traduce el valor interno de prioridad a la etiqueta que se muestra al usuario. */
  it('translates priority to a Spanish label', () => {
    expect(priorityLabel('high')).toBe('Alta');
    expect(priorityLabel('medium')).toBe('Media');
    expect(priorityLabel('low')).toBe('Baja');
  });

  /** El peso numérico permite ordenar: alta primero, luego media, luego baja. */
  it('orders high before medium before low', () => {
    expect(priorityWeight('high')).toBeLessThan(priorityWeight('medium'));
    expect(priorityWeight('medium')).toBeLessThan(priorityWeight('low'));
  });
});
