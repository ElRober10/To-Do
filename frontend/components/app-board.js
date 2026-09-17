import './board-column.js';
import './task-modal.js';
import { api } from '../services/api.js';

const STATUSES = [
  { key: 'backlog', label: 'Idea' },
  { key: 'planning', label: 'Planificación' },
  { key: 'in_progress', label: 'Ejecución' },
  { key: 'testing', label: 'Pruebas' },
  { key: 'done', label: 'Producción' },
];

export class AppBoard extends HTMLElement {
  #board = null;
  #tasks = [];

  /** Al insertarse en el DOM: comprueba sesión, carga el tablero (o el aviso de login) y pinta. */
  async connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.renderLoading();

    const { user } = await api.me();
    if (!user) {
      this.renderLoginRequired();
      return;
    }

    await this.loadBoard();
    this.render();

    this.shadowRoot.addEventListener('task-drop', (event) => this.handleTaskDrop(event));

    this.shadowRoot.addEventListener('task-save', async (event) => {
      await api.createTask({ boardId: this.#board.id, ...event.detail });
      const { tasks } = await api.listTasks(this.#board.id);
      this.#tasks = tasks;
      this.render();
    });

    this.shadowRoot.addEventListener('task-cancel', () => {
      this.shadowRoot.querySelector('task-modal').close();
    });
  }

  /** Trae (o crea) el primer tablero del usuario y sus tareas. */
  async loadBoard() {
    const { boards } = await api.listBoards();
    this.#board = boards[0] ?? (await api.createBoard('Mi tablero')).board;
    const { tasks } = await api.listTasks(this.#board.id);
    this.#tasks = tasks;
  }

  /** Actualiza la UI al instante (optimista) y confirma el cambio en la API; si falla, revierte. */
  async handleTaskDrop(event) {
    const { taskId, status, position } = event.detail;
    const previous = this.#tasks.map((t) => ({ ...t }));

    this.#tasks = this.#tasks.map((t) =>
      t.id === taskId ? { ...t, status, position } : t
    );
    this.render();

    try {
      await api.moveTask(taskId, status, position);
    } catch (err) {
      this.#tasks = previous;
      this.render();
    }
  }

  /** Mensaje de carga inicial. */
  renderLoading() {
    this.shadowRoot.innerHTML = '<p style="padding:16px">Cargando…</p>';
  }

  /** Mensaje cuando no hay sesión activa (los formularios de login llegan en la Tarea 13). */
  renderLoginRequired() {
    this.shadowRoot.innerHTML = '<p style="padding:16px">Inicia sesión para ver tu tablero.</p>';
  }

  /** Pinta el botón de nueva tarea, las 5 columnas y el modal (oculto hasta que se abre). */
  render() {
    this.shadowRoot.innerHTML = '<button id="add">+ Nueva tarea</button><div class="board"></div><task-modal></task-modal>';
    this.shadowRoot.querySelector('#add').addEventListener('click', () => {
      this.shadowRoot.querySelector('task-modal').open(null);
    });

    const board = this.shadowRoot.querySelector('.board');
    board.style.cssText = 'display:flex;gap:16px;padding:16px;overflow-x:auto;';

    for (const status of STATUSES) {
      const column = document.createElement('board-column');
      column.setAttribute('status', status.key);
      column.setAttribute('title', status.label);
      column.tasks = this.#tasks
        .filter((t) => t.status === status.key)
        .sort((a, b) => a.position - b.position);
      board.appendChild(column);
    }
  }
}

customElements.define('app-board', AppBoard);
