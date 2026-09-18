import { priorityLabel, priorityColor } from '../utils/priority.js';
import { closestAcrossShadow, elementFromPointDeep } from '../utils/dom.js';
import { escapeHtml } from '../utils/html.js';

/** Colores de la píldora de prioridad: rojo para alta, ámbar para media, verde para baja. */
const PRIORITY_PILL = {
  high: { bg: '#fee2e2', fg: '#b91c1c' },
  medium: { bg: '#fef3c7', fg: '#92400e' },
  low: { bg: '#dcfce7', fg: '#166534' },
};

function priorityPillColors(priority) {
  return PRIORITY_PILL[priority] ?? { bg: 'var(--color-surface-hover)', fg: 'var(--color-text-secondary)' };
}

export class TaskCard extends HTMLElement {
  #task = null;

  /** Asigna los datos de la tarea y repinta la tarjeta. */
  set task(value) {
    this.#task = value;
    this.render();
  }

  get task() {
    return this.#task;
  }

  /** Se ejecuta cuando el navegador inserta el elemento en el DOM: prepara Shadow DOM y el arrastre manual. */
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.addEventListener('pointerdown', (event) => this.startDrag(event));
    this.render();
  }

  /** Arrastre manual: la propia tarjeta sigue al cursor con opacidad completa, sin depender del navegador. */
  startDrag(event) {
    if (event.button !== 0) return;

    const rect = this.getBoundingClientRect();
    const grabX = event.clientX - rect.left;
    const grabY = event.clientY - rect.top;
    let hoveredColumn = null;
    let moved = false;

    this.setPointerCapture(event.pointerId);
    this.classList.add('dragging');
    Object.assign(this.style, {
      position: 'fixed',
      zIndex: '1000',
      width: `${rect.width}px`,
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      pointerEvents: 'none',
    });

    const onMove = (moveEvent) => {
      if (Math.abs(moveEvent.clientX - event.clientX) > 4 || Math.abs(moveEvent.clientY - event.clientY) > 4) {
        moved = true;
      }

      this.style.left = `${moveEvent.clientX - grabX}px`;
      this.style.top = `${moveEvent.clientY - grabY}px`;

      const under = elementFromPointDeep(moveEvent.clientX, moveEvent.clientY);
      const column = closestAcrossShadow(under, 'board-column');

      if (column !== hoveredColumn) {
        hoveredColumn?.unhighlight();
        column?.highlight();
        hoveredColumn = column;
      }
    };

    const onUp = (upEvent) => {
      this.removeEventListener('pointermove', onMove);
      this.removeEventListener('pointerup', onUp);
      this.releasePointerCapture(upEvent.pointerId);

      this.classList.remove('dragging');
      Object.assign(this.style, {
        position: '', zIndex: '', width: '', left: '', top: '', pointerEvents: '',
      });

      if (moved) {
        const targetStatus = hoveredColumn?.getAttribute('status');
        const blocksIncompleteChecklist = targetStatus === 'testing' || targetStatus === 'done';
        const hasPendingChecklistItems = (this.#task.checklistItems ?? []).some((item) => !item.completed);

        if (blocksIncompleteChecklist && hasPendingChecklistItems) {
          hoveredColumn?.unhighlight();
          this.dispatchEvent(new CustomEvent('task-blocked', {
            detail: { message: 'No puedes mover una tarea con pasos de checklist sin completar a Pruebas o Producción.' },
            bubbles: true,
            composed: true,
          }));
          return;
        }

        hoveredColumn?.acceptDrop(this.#task.id);
      } else {
        hoveredColumn?.unhighlight();
        this.dispatchEvent(new CustomEvent('task-edit', { detail: this.#task, bubbles: true, composed: true }));
      }
    };

    this.addEventListener('pointermove', onMove);
    this.addEventListener('pointerup', onUp);
  }

  /** HTML de la barra de progreso de checklist (vacío si la tarea no tiene pasos). */
  renderChecklistProgress(items) {
    if (!items || items.length === 0) return '';

    const done = items.filter((item) => item.completed).length;
    const percent = Math.round((done / items.length) * 100);

    return `
      <div class="checklist-progress">
        <span>${done}/${items.length}</span>
        <span class="bar"><span class="fill" style="width:${percent}%"></span></span>
      </div>
    `;
  }

  /** Pinta la tarjeta dentro de su Shadow DOM con los datos actuales. */
  render() {
    if (!this.shadowRoot || !this.#task) return;

    const t = this.#task;
    const pill = priorityPillColors(t.priority);
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, sans-serif; }
        .card {
          background: var(--color-surface-hover);
          border-radius: var(--radius-sm);
          padding: 12px;
          margin-bottom: 8px;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--color-border);
          border-left: 4px solid ${priorityColor(t.priority)};
          transition: transform .15s ease, box-shadow .15s ease;
          animation: card-in .2s ease-out;
          cursor: grab;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        :host(.dragging) .card { transform: scale(1.03); box-shadow: var(--shadow-md); cursor: grabbing; }
        h3 { margin: 0 0 6px; font-size: 14px; color: var(--color-text); }
        p { margin: 0 0 10px; font-size: 12px; color: var(--color-text-secondary); }
        .meta { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
        .priority-pill {
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          background: ${pill.bg};
          color: ${pill.fg};
        }
        .due-date { color: var(--color-text-secondary); }
        .checklist-progress { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 11px; color: var(--color-text-secondary); }
        .checklist-progress .bar { flex: 1; height: 4px; border-radius: 2px; background: var(--color-surface-hover); overflow: hidden; }
        .checklist-progress .fill { height: 100%; background: #16a34a; border-radius: 2px; transition: width .15s ease; }
      </style>
      <div class="card">
        <h3>${escapeHtml(t.title)}</h3>
        ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ''}
        ${this.renderChecklistProgress(t.checklistItems)}
        <div class="meta">
          <span class="priority-pill">${escapeHtml(priorityLabel(t.priority))}</span>
          <span class="due-date">${escapeHtml(t.dueDate ?? '')}</span>
        </div>
      </div>
    `;
  }
}

customElements.define('task-card', TaskCard);
