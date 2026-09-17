import './task-card.js';
import { computeDropPosition } from '../utils/reorder.js';

export class BoardColumn extends HTMLElement {
  #tasks = [];

  /** Asigna las tareas de esta columna y repinta. */
  set tasks(value) {
    this.#tasks = value;
    this.render();
  }

  get tasks() {
    return this.#tasks;
  }

  /** Prepara el Shadow DOM. La detección del arrastre la controla task-card (drag manual, no HTML5 nativo). */
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  /** Resalta la columna (la tarjeta arrastrada está encima). Lo llama task-card durante el arrastre. */
  highlight() {
    this.shadowRoot.querySelector('.column')?.classList.add('drag-over');
  }

  /** Quita el resalte. */
  unhighlight() {
    this.shadowRoot.querySelector('.column')?.classList.remove('drag-over');
  }

  /** Acepta una tarea soltada aquí: calcula su nueva posición y avisa hacia fuera con task-drop. */
  acceptDrop(taskId) {
    this.unhighlight();

    const positions = this.#tasks.map((t) => t.position);
    const position = computeDropPosition(positions, positions.length);

    this.dispatchEvent(new CustomEvent('task-drop', {
      detail: { taskId, status: this.getAttribute('status'), position },
      bubbles: true,
      composed: true,
    }));
  }

  /** Pinta la columna: su título y una <task-card> por cada tarea. */
  render() {
    if (!this.shadowRoot) return;

    const title = this.getAttribute('title') ?? '';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .column {
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          background: #ebecf0;
          border-radius: 8px;
          padding: 8px;
          min-width: 260px;
          transition: background .15s ease;
        }
        .column.drag-over { background: #dcdfe6; }
        h2 { font-size: 13px; text-transform: uppercase; color: #5e6c84; margin: 4px 8px 12px; }
        .cards { flex: 1; }
      </style>
      <div class="column">
        <h2>${title}</h2>
        <div class="cards"></div>
      </div>
    `;

    const container = this.shadowRoot.querySelector('.cards');
    for (const task of this.#tasks) {
      const card = document.createElement('task-card');
      card.task = task;
      container.appendChild(card);
    }
  }
}

customElements.define('board-column', BoardColumn);
