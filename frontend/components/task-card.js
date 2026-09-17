import { priorityLabel } from '../utils/priority.js';

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

  /** Se ejecuta cuando el navegador inserta el elemento en el DOM: prepara Shadow DOM y drag&drop. */
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.setAttribute('draggable', 'true');
    this.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(this.#task.id));
      this.classList.add('dragging');
    });
    this.addEventListener('dragend', () => this.classList.remove('dragging'));
    this.render();
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
