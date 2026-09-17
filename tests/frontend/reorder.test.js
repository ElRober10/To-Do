import { describe, it, expect } from 'vitest';
import { computeDropPosition } from '../../frontend/utils/reorder.js';

describe('computeDropPosition', () => {
  /** Columna vacía: la primera tarea entra en posición 0. */
  it('returns 0 for an empty column', () => {
    expect(computeDropPosition([], 0)).toBe(0);
  });

  /** Soltar al final añade después de la última posición existente. */
  it('appends after the last position when dropped at the end', () => {
    expect(computeDropPosition([0, 1, 2], 3)).toBe(3);
  });

  /** Soltar en medio toma la posición de la tarea que hay ahí actualmente. */
  it('takes the position of the task currently at dropIndex when inserting in the middle', () => {
    expect(computeDropPosition([0, 1, 2], 1)).toBe(1);
  });
});
