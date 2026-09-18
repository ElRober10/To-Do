import { buttonStyles, formStyles } from '../styles/shared.js';
import { escapeHtml } from '../utils/html.js';

const TRASH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

export class TaskModal extends HTMLElement {
  #task = null;
  #checklistDraft = [];
  #originalChecklist = [];

  /** Asigna la tarea a editar (o null en modo creación) y repinta el formulario. Copia la checklist a un borrador en memoria: nada se guarda en la API hasta pulsar "Guardar". */
  set task(value) {
    this.#task = value;
    this.#checklistDraft = (value?.checklistItems ?? []).map((item) => ({ ...item }));
    this.#originalChecklist = (value?.checklistItems ?? []).map((item) => ({ ...item }));
    this.render();
  }

  /** Prepara el Shadow DOM; el modal empieza oculto. */
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.hidden = true;
    this.render();
  }

  /** Abre el modal, en modo creación (task=null) o edición (task=objeto). */
  open(task = null) {
    this.task = task;
    this.hidden = false;
  }

  /** Cierra el modal. */
  close() {
    this.hidden = true;
  }

  /** Pinta el formulario con los valores actuales (vacíos si es una tarea nueva). */
  render() {
    if (!this.shadowRoot) return;
    const t = this.#task ?? { title: '', description: '', priority: 'medium', dueDate: '' };

    this.shadowRoot.innerHTML = `
      <style>
        ${buttonStyles}
        ${formStyles}
        :host { font-family: system-ui, sans-serif; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal {
          background: var(--color-surface);
          border-radius: var(--radius);
          box-shadow: var(--shadow-md);
          padding: 24px;
          width: min(420px, 90vw);
          animation: pop .15s ease;
        }
        @keyframes pop { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        h2 { margin: 0 0 4px; font-size: 16px; color: var(--color-text); }
        .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
        .actions .btn { width: auto; }
        .checklist { margin-top: 12px; }
        .checklist-items { list-style: none; margin: 6px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .checklist-items li { display: flex; align-items: center; gap: 8px; }
        .checklist-items .checklist-spacer { width: 16px; height: 16px; flex: none; }
        .checklist-items li span { flex: 1; font-size: 13px; color: var(--color-text); }
        .checklist-items li span.done { text-decoration: line-through; color: var(--color-text-secondary); }
        .checklist-items button { display: inline-flex; align-items: center; background: none; border: none; color: var(--color-text-secondary); cursor: pointer; padding: 4px; transition: transform .08s ease; }
        .checklist-items button:active { transform: scale(.85); }
        .checklist-items button:hover { color: var(--color-danger); }
        .checklist-add { display: flex; gap: 8px; margin-top: 4px; }
        .checklist-add input { flex: 1; }
        .checklist-add .btn { width: auto; white-space: nowrap; }
        .confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 200; }
        .confirm-box {
          background: var(--color-surface);
          border-radius: var(--radius);
          box-shadow: var(--shadow-md);
          padding: 20px;
          width: min(300px, 85vw);
          animation: pop .15s ease;
        }
        .confirm-box p { margin: 0 0 16px; font-size: 13px; color: var(--color-text); }
        .confirm-box .actions { margin-top: 0; }
        .btn-danger { background: var(--color-danger); color: #fff; }
        .btn-danger:hover { opacity: .9; }
      </style>
      <div class="overlay">
        <form class="modal">
          <h2>${t.id ? 'Editar tarea' : 'Nueva tarea'}</h2>
          <label>Título<input name="title" required value="${escapeHtml(t.title)}"></label>
          <label>Descripción<textarea name="description">${escapeHtml(t.description)}</textarea></label>
          <label>Prioridad
            <select name="priority">
              <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Baja</option>
              <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Media</option>
              <option value="high" ${t.priority === 'high' ? 'selected' : ''}>Alta</option>
            </select>
          </label>
          <label>Fecha límite<input type="date" name="dueDate" value="${escapeHtml(t.dueDate ?? '')}"></label>
          <div data-role="checklist-container">
            ${this.renderChecklist(this.#checklistDraft)}
          </div>
          <div class="actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    `;

    const form = this.shadowRoot.querySelector('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton.disabled) return;
      submitButton.disabled = true;

      const data = Object.fromEntries(new FormData(form).entries());
      if (this.#task?.id) {
        data.id = this.#task.id;
      }
      data.checklistDiff = this.computeChecklistDiff();
      this.dispatchEvent(new CustomEvent('task-save', { detail: data, bubbles: true, composed: true }));
    });

    this.shadowRoot.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true, composed: true }));
    });

    this.wireChecklistEvents();
  }

  /** Compara el borrador de checklist contra el estado original para saber qué hay que crear, marcar/desmarcar o borrar en la API al Guardar. */
  computeChecklistDiff() {
    const originalById = new Map(this.#originalChecklist.map((item) => [item.id, item]));
    const draftIds = new Set(this.#checklistDraft.filter((item) => item.id != null).map((item) => item.id));

    const create = this.#checklistDraft.filter((item) => item.id == null).map((item) => item.text);

    const update = this.#checklistDraft
      .filter((item) => item.id != null && originalById.get(item.id)?.completed !== item.completed)
      .map((item) => ({ id: item.id, completed: item.completed }));

    const remove = this.#originalChecklist
      .filter((item) => !draftIds.has(item.id))
      .map((item) => item.id);

    return { create, update, remove };
  }

  /** Muestra un mini-modal de confirmación dentro del propio shadow DOM (en vez de un confirm() nativo) y resuelve true/false según lo que elija el usuario. */
  confirmDelete(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <p>${escapeHtml(message)}</p>
          <div class="actions">
            <button type="button" class="btn btn-secondary" data-action="confirm-cancel">Cancelar</button>
            <button type="button" class="btn btn-danger" data-action="confirm-ok">Borrar</button>
          </div>
        </div>
      `;
      this.shadowRoot.appendChild(overlay);

      const finish = (result) => {
        overlay.remove();
        resolve(result);
      };
      overlay.querySelector('[data-action="confirm-cancel"]').addEventListener('click', () => finish(false));
      overlay.querySelector('[data-action="confirm-ok"]').addEventListener('click', () => finish(true));
    });
  }

  /** Repinta solo la sección de checklist (no el formulario entero), para no perder lo que el usuario haya escrito en título/descripción/etc. */
  updateChecklistSection() {
    const container = this.shadowRoot.querySelector('[data-role="checklist-container"]');
    if (!container) return;

    container.innerHTML = this.renderChecklist(this.#checklistDraft);
    this.wireChecklistEvents();
  }

  /** HTML de la sección de checklist: lista de pasos + mini-formulario para añadir uno nuevo. Todo vive en el borrador en memoria hasta "Guardar". */
  renderChecklist(items) {
    return `
      <label>Checklist</label>
      <ul class="checklist-items">
        ${items.map((item, index) => `
          <li data-index="${index}">
            ${item.id != null
              ? `<input type="checkbox" data-action="toggle-item" ${item.completed ? 'checked' : ''}>`
              : '<span class="checklist-spacer"></span>'}
            <span class="${item.completed ? 'done' : ''}">${escapeHtml(item.text)}</span>
            ${item.completed ? '' : `<button type="button" data-action="delete-item" aria-label="Borrar paso">${TRASH_ICON}</button>`}
          </li>
        `).join('')}
      </ul>
      <div class="checklist-add" data-role="add-item-form">
        <input type="text" placeholder="Nuevo paso" data-role="new-item-text">
        <button type="button" class="btn btn-secondary" data-action="add-item">Añadir</button>
      </div>
    `;
  }

  /** Engancha los eventos de la checklist: marcar, borrar, añadir. Todo en memoria; se envía a la API junto con "Guardar". */
  wireChecklistEvents() {
    this.shadowRoot.querySelectorAll('[data-action="toggle-item"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const index = Number(checkbox.closest('li').dataset.index);
        this.#checklistDraft = this.#checklistDraft.map((item, i) =>
          (i === index ? { ...item, completed: checkbox.checked } : item)
        );
        this.updateChecklistSection();
      });
    });

    this.shadowRoot.querySelectorAll('[data-action="delete-item"]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!(await this.confirmDelete('¿Borrar este paso?'))) return;
        const index = Number(button.closest('li').dataset.index);
        this.#checklistDraft = this.#checklistDraft.filter((_, i) => i !== index);
        this.updateChecklistSection();
      });
    });

    this.shadowRoot.querySelector('[data-action="add-item"]').addEventListener('click', () => {
      this.addChecklistItem();
    });

    this.shadowRoot.querySelector('[data-role="new-item-text"]').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addChecklistItem();
      }
    });
  }

  /** Añade un paso nuevo al borrador en memoria y repinta (con foco de nuevo en el campo, para poder seguir añadiendo). */
  addChecklistItem() {
    const input = this.shadowRoot.querySelector('[data-role="new-item-text"]');
    const text = input.value.trim();
    if (!text) return;

    this.#checklistDraft = [...this.#checklistDraft, { id: null, text, completed: false }];
    this.updateChecklistSection();
    this.shadowRoot.querySelector('[data-role="new-item-text"]')?.focus();
  }
}

customElements.define('task-modal', TaskModal);
