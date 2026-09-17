import './board-column.js';
import './task-modal.js';
import './login-form.js';
import './register-form.js';
import { api } from '../services/api.js';
import { buttonStyles } from '../styles/shared.js';

const STATUSES = [
  { key: 'backlog', label: 'Idea' },
  { key: 'planning', label: 'Planificación' },
  { key: 'in_progress', label: 'Ejecución' },
  { key: 'testing', label: 'Pruebas' },
  { key: 'done', label: 'Producción' },
];

const THEME_KEY = 'taskboard-theme';

export class AppBoard extends HTMLElement {
  #board = null;
  #tasks = [];
  #user = null;
  #authMode = 'login';
  #authListenerAttached = false;

  /** Al insertarse en el DOM: comprueba sesión, carga el tablero (o el aviso de login) y pinta. */
  async connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.renderLoading();

    const { user } = await api.me();
    this.#user = user;
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

  /** Cambia entre tema claro y oscuro, y recuerda la elección para la próxima visita. */
  toggleTheme(button) {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    button.textContent = next === 'dark' ? 'Modo claro' : 'Modo oscuro';
  }

  /** Cierra la sesión actual y vuelve a la pantalla de login. */
  async logout() {
    await api.logout();
    this.#user = null;
    this.#authMode = 'login';
    this.renderLoginRequired();
  }

  /** Mensaje de carga inicial. */
  renderLoading() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; min-height: 100vh; background: var(--color-bg); }
        p { padding: 24px; color: var(--color-text-secondary); font-family: system-ui, sans-serif; }
      </style>
      <p>Cargando…</p>
    `;
  }

  /** Sin sesión activa: muestra el formulario de login O el de registro (nunca los dos), con un enlace para alternar. */
  renderLoginRequired() {
    const isLogin = this.#authMode === 'login';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .auth-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          padding: 16px;
        }
        .auth-card {
          background: var(--color-surface);
          border-radius: var(--radius);
          box-shadow: var(--shadow-md);
          padding: 32px;
          width: 100%;
          max-width: 360px;
          font-family: system-ui, sans-serif;
        }
        .auth-card h1 {
          margin: 0 0 4px;
          text-align: center;
          color: var(--color-text);
        }
        .auth-card h2 {
          margin: 0 0 20px;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }
        .switch {
          margin: 16px 0 0;
          text-align: center;
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .switch button {
          font: inherit;
          font-weight: 600;
          color: var(--color-primary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
      </style>
      <div class="auth-screen">
        <div class="auth-card">
          <h1>Taskboard</h1>
          <h2>${isLogin ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}</h2>
          ${isLogin ? '<login-form></login-form>' : '<register-form></register-form>'}
          <p class="switch">
            ${isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button type="button" data-action="switch-auth">${isLogin ? 'Regístrate' : 'Inicia sesión'}</button>
          </p>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector('[data-action="switch-auth"]').addEventListener('click', () => {
      this.#authMode = isLogin ? 'register' : 'login';
      this.renderLoginRequired();
    });

    if (!this.#authListenerAttached) {
      this.#authListenerAttached = true;
      this.shadowRoot.addEventListener('auth-success', async () => {
        this.#authListenerAttached = false;
        const { user } = await api.me();
        this.#user = user;
        await this.loadBoard();
        this.render();
      }, { once: true });
    }
  }

  /** Pinta la cabecera (título, nueva tarea, tema, usuario y logout), las 5 columnas y el modal. */
  render() {
    const root = document.documentElement;
    const themeLabel = root.dataset.theme === 'dark' ? 'Modo claro' : 'Modo oscuro';

    this.shadowRoot.innerHTML = `
      <style>
        ${buttonStyles}
        :host { display: block; }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 16px 24px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          font-family: system-ui, sans-serif;
        }
        .topbar-left { display: flex; align-items: center; gap: 16px; }
        .topbar h1 { font-size: 18px; margin: 0; color: var(--color-text); }
        .topbar-right { display: flex; align-items: center; gap: 12px; }
        .user-email { font-size: 13px; color: var(--color-text-secondary); }

        .board {
          display: flex;
          gap: 16px;
          padding: 24px;
          overflow-x: auto;
          min-height: calc(100vh - 145px);
          align-items: stretch;
        }
        @media (max-width: 768px) {
          .board { flex-direction: column; overflow-x: visible; min-height: auto; }
        }
      </style>
      <header class="topbar">
        <div class="topbar-left">
          <h1>Taskboard</h1>
          <button id="add" class="btn btn-primary">+ Nueva tarea</button>
        </div>
        <div class="topbar-right">
          <button id="theme-toggle" class="btn btn-secondary">${themeLabel}</button>
          <span class="user-email">${this.#user?.email ?? ''}</span>
          <button id="logout" class="btn btn-secondary">Cerrar sesión</button>
        </div>
      </header>
      <div class="board"></div>
      <task-modal></task-modal>
    `;

    this.shadowRoot.querySelector('#add').addEventListener('click', () => {
      this.shadowRoot.querySelector('task-modal').open(null);
    });
    this.shadowRoot.querySelector('#theme-toggle').addEventListener('click', (event) => {
      this.toggleTheme(event.currentTarget);
    });
    this.shadowRoot.querySelector('#logout').addEventListener('click', () => this.logout());

    const board = this.shadowRoot.querySelector('.board');
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
