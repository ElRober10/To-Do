import { describe, it, expect } from 'vitest';
import { closestAcrossShadow, elementFromPointDeep } from '../../frontend/utils/dom.js';

describe('closestAcrossShadow', () => {
  /** Encuentra un ancestro normal, sin Shadow DOM de por medio (caso simple). */
  it('finds a plain ancestor without shadow boundaries', () => {
    document.body.innerHTML = '<div id="outer"><span id="inner"></span></div>';
    const inner = document.getElementById('inner');

    expect(closestAcrossShadow(inner, '#outer')).toBe(document.getElementById('outer'));
  });

  /** Atraviesa un límite de Shadow DOM para encontrar un ancestro fuera de él. */
  it('crosses a shadow boundary to find an ancestor outside it', () => {
    const host = document.createElement('div');
    host.id = 'host';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const innerDiv = document.createElement('div');
    shadow.appendChild(innerDiv);

    expect(closestAcrossShadow(innerDiv, '#host')).toBe(host);
  });

  /** Devuelve null si no hay ningún ancestro que coincida. */
  it('returns null when nothing matches', () => {
    document.body.innerHTML = '<div id="outer"><span id="inner"></span></div>';
    const inner = document.getElementById('inner');

    expect(closestAcrossShadow(inner, '.no-existe')).toBeNull();
  });
});

describe('elementFromPointDeep', () => {
  /** document.elementFromPoint() solo llega al host del primer Shadow DOM; hay que repetir la llamada dentro de cada shadowRoot anidado para llegar al elemento real. */
  it('desciende a través de varios Shadow DOM anidados hasta el elemento más interno', () => {
    const innermost = { name: 'innermost' };
    const columnShadowRoot = { elementFromPoint: () => innermost };
    const boardColumn = { shadowRoot: columnShadowRoot };
    const appShadowRoot = { elementFromPoint: () => boardColumn };
    const appBoard = { shadowRoot: appShadowRoot };
    const fakeRoot = { elementFromPoint: () => appBoard };

    expect(elementFromPointDeep(10, 20, fakeRoot)).toBe(innermost);
  });

  /** Si el elemento no tiene Shadow DOM, se devuelve tal cual (caso simple, sin anidamiento). */
  it('devuelve el elemento directamente si no tiene shadowRoot', () => {
    const plain = {};
    const fakeRoot = { elementFromPoint: () => plain };

    expect(elementFromPointDeep(0, 0, fakeRoot)).toBe(plain);
  });

  /** Si no hay nada en ese punto, devuelve null en vez de fallar. */
  it('devuelve null si no hay nada en ese punto', () => {
    const fakeRoot = { elementFromPoint: () => null };

    expect(elementFromPointDeep(0, 0, fakeRoot)).toBeNull();
  });
});
