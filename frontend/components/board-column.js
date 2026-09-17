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
          font-family: system-ui, sans-serif;
        }
        .column {
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-sm);
          padding: 12px;
          min-width: 260px;
          transition: background .15s ease, box-shadow .15s ease;
        }
        .column.drag-over {
          background: var(--color-surface-hover);
          box-shadow: 0 0 0 2px var(--color-primary) inset;
        }
        .column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 2px 4px 12px;
        }
        h2 {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: .03em;
          color: var(--color-text-secondary);
          margin: 0;
        }
        .count {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary);
          background: var(--color-bg);
          border-radius: 999px;
          padding: 2px 8px;
        }
        .cards { flex: 1; display: flex; flex-direction: column; }
        .empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--color-text-secondary);
          text-align: center;
          padding: 16px;
        }
      </style>
      <div class="column">
        <div class="column-header">
          <h2>${title}</h2>
          <span class="count">${this.#tasks.length}</span>
        </div>
        <div class="cards"></div>
      </div>
    `;

    const container = this.shadowRoot.querySelector('.cards');
    if (this.#tasks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Sin tareas';
      container.appendChild(empty);
      return;
    }

    for (const task of this.#tasks) {
      const card = document.createElement('task-card');
      card.task = task;
      container.appendChild(card);
    }
  }
}

customElements.define('board-column', BoardColumn);
