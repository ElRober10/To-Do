/** Busca el ancestro más cercano que cumpla el selector, atravesando límites de Shadow DOM (que .closest() no cruza). */
export function closestAcrossShadow(element, selector) {
  let node = element;

  while (node) {
    if (node.matches?.(selector)) {
      return node;
    }

    node = node.parentElement ?? (node.getRootNode() instanceof ShadowRoot ? node.getRootNode().host : null);
  }

  return null;
}

/** document.elementFromPoint() solo perfora el primer Shadow DOM y devuelve su host; hay que repetir la búsqueda dentro de cada shadowRoot anidado para llegar al elemento real bajo el cursor. */
export function elementFromPointDeep(x, y, root = document) {
  let node = root.elementFromPoint(x, y);

  while (node?.shadowRoot) {
    const inner = node.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === node) break;
    node = inner;
  }

  return node;
}
