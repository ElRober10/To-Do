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
    this.shadowRoot.innerHTML = `
      <style>
        .card {
          background: #fff;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,.1);
          border-left: 4px solid ${safeColor(t.color)};
          transition: transform .15s ease, box-shadow .15s ease;
          animation: card-in .2s ease-out;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        :host(.dragging) .card { transform: scale(1.03); box-shadow: 0 4px 10px rgba(0,0,0,.2); }
        h3 { margin: 0 0 4px; font-size: 14px; }
        p { margin: 0 0 8px; font-size: 12px; color: #5e6c84; }
        .meta { display: flex; justify-content: space-between; font-size: 11px; color: #5e6c84; }
      </style>
      <div class="card">
        <h3>${escapeHtml(t.title)}</h3>
        ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ''}
        <div class="meta">
          <span>${escapeHtml(priorityLabel(t.priority))}</span>
          <span>${escapeHtml(t.dueDate ?? '')}</span>
        </div>
      </div>
    `;
  }
}

customElements.define('task-card', TaskCard);
