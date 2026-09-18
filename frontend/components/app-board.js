import './board-column.js';
import './task-modal.js';
import './login-form.js';
import './register-form.js';
import { api } from '../services/api.js';
import { buttonStyles } from '../styles/shared.js';

/** Escapa texto de usuario antes de insertarlo en innerHTML, para evitar XSS. */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

const STATUSES = [
  { key: 'backlog', label: 'Descripción y requisitos' },
  { key: 'planning', label: 'Planificación' },
  { key: 'in_progress', label: 'Ejecución' },
  { key: 'testing', label: 'Pruebas' },
  { key: 'done', label: 'Producción' },
];

const THEME_KEY = 'taskboard-theme';

const SUN_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const MOON_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

/** Icono del botón de tema: muestra el icono del modo AL QUE SE CAMBIARÍA si se pulsa (luna si estás en claro, sol si estás en oscuro). */
function themeToggleIcon(currentTheme) {
  return currentTheme === 'dark' ? SUN_ICON : MOON_ICON;
}

export class AppBoard extends HTMLElement {
  #board = null;
  #tasks = [];
  #user = null;
  #authMode = 'login';
  #authListenerAttached = false;

  /** Al insertarse en el DOM: comprueba sesión, sincroniza con la URL actual (/, /register, /panel), carga el tablero (o el aviso de login) y pinta. */
  async connectedCallback() {
    this.attachShadow({ mode: 'open' });
    window.addEventListener('popstate', () => this.handlePopState());
    this.renderLoading();

    const { user } = await api.me();
    this.#user = user;

    if (!user) {
      this.#authMode = location.pathname === '/register' ? 'register' : 'login';
      if (location.pathname !== '/' && location.pathname !== '/register') {
        history.replaceState(null, '', '/');
      }
      this.renderLoginRequired();
      return;
    }

    if (location.pathname !== '/panel') {
      history.replaceState(null, '', '/panel');
    }

    await this.loadBoard();
    this.render();

    this.shadowRoot.addEventListener('task-drop', (event) => this.handleTaskDrop(event));

    this.shadowRoot.addEventListener('task-save', async (event) => {
      const { id, checklistDiff, ...data } = event.detail;
      let taskId = id;

      if (id) {
        await api.updateTask(id, data);
      } else {
        const { task } = await api.createTask({ boardId: this.#board.id, ...data });
        taskId = task.id;
      }

      await this.applyChecklistDiff(taskId, checklistDiff);

      const { tasks } = await api.listTasks(this.#board.id);
      this.#tasks = tasks;
      this.render();
    });

    this.shadowRoot.addEventListener('task-cancel', () => {
      this.shadowRoot.querySelector('task-modal').close();
      this.render();
    });

    this.shadowRoot.addEventListener('task-edit', (event) => {
      this.shadowRoot.querySelector('task-modal').open(event.detail);
    });

    this.shadowRoot.addEventListener('task-blocked', (event) => {
      this.showToast(event.detail.message);
    });
  }

  /** Muestra un aviso flotante temporal (p.ej. al bloquear un movimiento inválido). */
  showToast(message) {
    this.shadowRoot.querySelector('.toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.shadowRoot.appendChild(toast);

    setTimeout(() => toast.remove(), 6000);
  }

  /** Aplica en la API los cambios de checklist hechos en el modal (la checklist vive en memoria hasta "Guardar", no se guarda al instante). */
  async applyChecklistDiff(taskId, diff) {
    if (!diff) return;

    for (const text of diff.create ?? []) {
      await api.createChecklistItem(taskId, text);
    }
    for (const item of diff.update ?? []) {
      await api.updateChecklistItem(item.id, { completed: item.completed });
    }
    for (const itemId of diff.remove ?? []) {
      await api.deleteChecklistItem(itemId);
    }
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
      this.showToast(err.message ?? 'No se pudo mover la tarea');
    }
  }

  /** Cambia entre tema claro y oscuro, y recuerda la elección para la próxima visita. */
  toggleTheme(button) {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    button.innerHTML = themeToggleIcon(next);
    button.setAttribute('aria-label', next === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  /** Cierra la sesión actual y vuelve a la pantalla de login. */
  async logout() {
    await api.logout();
    this.#user = null;
    this.#authMode = 'login';
    history.pushState(null, '', '/');
    this.renderLoginRequired();
  }

  /** Reacciona al botón atrás/adelante del navegador, sincronizando la pantalla con la URL. */
  handlePopState() {
    if (this.#user) {
      if (location.pathname !== '/panel') {
        history.replaceState(null, '', '/panel');
      }
      return;
    }

    this.#authMode = location.pathname === '/register' ? 'register' : 'login';
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

  /** Sin sesión activa: tarjeta con animación de "voltear" (como una moneda) entre login (cara) y registro (cruz). */
  renderLoginRequired() {
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
        .auth-wrap {
          width: 100%;
          max-width: 360px;
          font-family: system-ui, sans-serif;
        }
        .auth-wrap > h1 {
          margin: 0 0 20px;
          text-align: center;
          color: var(--color-text);
        }
        .auth-flip-outer {
          perspective: 1200px;
        }
        .auth-flip {
          display: grid;
          align-items: start;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          transition: transform .6s cubic-bezier(.4, .2, .2, 1), height .4s ease;
        }
        .auth-flip.flipped { transform: rotateY(180deg); }
        .face {
          grid-area: 1 / 1;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          background: var(--color-surface);
          border-radius: var(--radius);
          box-shadow: var(--shadow-md);
          padding: 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }
        .face-back { transform: rotateY(180deg); }
        .face h2 {
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
        <div class="auth-wrap">
          <h1>Taskboard</h1>
          <div class="auth-flip-outer">
            <div class="auth-flip">
              <div class="face face-front">
                <h2>Inicia sesión para continuar</h2>
                <login-form></login-form>
                <p class="switch">¿No tienes cuenta? <button type="button" data-action="switch-auth">Regístrate</button></p>
              </div>
              <div class="face face-back">
                <h2>Crea tu cuenta</h2>
                <register-form></register-form>
                <p class="switch">¿Ya tienes cuenta? <button type="button" data-action="switch-auth">Inicia sesión</button></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const flip = this.shadowRoot.querySelector('.auth-flip');
    const front = this.shadowRoot.querySelector('.face-front');
    const back = this.shadowRoot.querySelector('.face-back');

    /** Ambas caras miden lo mismo (la más alta de las dos): se fija en cada cara, no solo en el contenedor, porque align-items:start no las estira solo. */
    const maxHeight = Math.max(front.scrollHeight, back.scrollHeight);
    flip.style.height = `${maxHeight}px`;
    front.style.height = `${maxHeight}px`;
    back.style.height = `${maxHeight}px`;
    flip.classList.toggle('flipped', this.#authMode === 'register');

    this.shadowRoot.querySelectorAll('[data-action="switch-auth"]').forEach((button) => {
      button.addEventListener('click', () => {
        this.#authMode = this.#authMode === 'login' ? 'register' : 'login';
        history.pushState(null, '', this.#authMode === 'register' ? '/register' : '/');
        flip.classList.toggle('flipped', this.#authMode === 'register');
      });
    });

    if (!this.#authListenerAttached) {
      this.#authListenerAttached = true;
      this.shadowRoot.addEventListener('auth-success', async () => {
        this.#authListenerAttached = false;
        const { user } = await api.me();
        this.#user = user;
        await this.loadBoard();
        history.pushState(null, '', '/panel');
        this.render();
      }, { once: true });
    }
  }

  /** Pinta la cabecera (título, nueva tarea, tema, usuario y logout), las 5 columnas y el modal. */
  render() {
    const root = document.documentElement;
    const themeIcon = themeToggleIcon(root.dataset.theme === 'dark' ? 'dark' : 'light');
    const themeAriaLabel = root.dataset.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

    this.shadowRoot.innerHTML = `
      <style>
        ${buttonStyles}
        :host { display: block; }
        .topbar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          font-family: system-ui, sans-serif;
        }
        .topbar-left { justify-self: start; display: flex; align-items: center; gap: 16px; }
        .topbar h1 { font-size: 18px; margin: 0; color: var(--color-text); }
        .topbar-center { justify-self: center; text-align: center; }
        .welcome { margin: 0; font-size: 13px; color: var(--color-text-secondary); white-space: nowrap; }
        .welcome strong { color: var(--color-text); }
        .topbar-right { justify-self: end; display: flex; align-items: center; gap: 12px; }
        .btn-icon {
          padding: 8px;
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        @media (max-width: 768px) {
          .topbar { grid-template-columns: 1fr; justify-items: center; text-align: center; }
          .topbar-left, .topbar-right { justify-self: center; }
        }

        .board {
          display: flex;
          justify-content: center;
          gap: 16px;
          padding: 24px;
          overflow-x: auto;
          min-height: calc(100vh - 145px);
          align-items: stretch;
        }
        @media (max-width: 768px) {
          .board { flex-direction: column; overflow-x: visible; min-height: auto; }
        }

        .toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-danger);
          color: #fff;
          padding: 10px 18px;
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-md);
          font-size: 13px;
          font-family: system-ui, sans-serif;
          max-width: min(360px, calc(100vw - 32px));
          text-align: center;
          z-index: 300;
          animation: toast-in .15s ease;
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      </style>
      <header class="topbar">
        <div class="topbar-left">
          <h1>Taskboard</h1>
          <button id="add" class="btn btn-primary">+ Nueva tarea</button>
        </div>
        <div class="topbar-center">
          <p class="welcome">Bienvenido, <strong>${escapeHtml(this.#user?.name)}</strong>, a tu panel de tareas</p>
        </div>
        <div class="topbar-right">
          <button id="theme-toggle" class="btn btn-secondary btn-icon" aria-label="${themeAriaLabel}">${themeIcon}</button>
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
