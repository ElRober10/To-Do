import { priorityLabel } from '../utils/priority.js';
import { closestAcrossShadow, elementFromPointDeep } from '../utils/dom.js';

/** Escapa texto de usuario antes de insertarlo en innerHTML, para evitar XSS. */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

/** Valida que sea un color hexadecimal (#rrggbb); si no, usa un gris neutro. Evita inyectar contenido dentro del <style>. */
function safeColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? value : '#dfe1e6';
}

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

      hoveredColumn?.acceptDrop(this.#task.id);
    };

    this.addEventListener('pointermove', onMove);
    this.addEventListener('pointerup', onUp);
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
          background: var(--color-surface);
          border-radius: var(--radius-sm);
          padding: 12px;
          margin-bottom: 8px;
          box-shadow: var(--shadow-sm);
          border-left: 4px solid ${safeColor(t.color)};
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
      </style>
      <div class="card">
        <h3>${escapeHtml(t.title)}</h3>
        ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ''}
        <div class="meta">
          <span class="priority-pill">${escapeHtml(priorityLabel(t.priority))}</span>
          <span class="due-date">${escapeHtml(t.dueDate ?? '')}</span>
        </div>
      </div>
    `;
  }
}

customElements.define('task-card', TaskCard);
