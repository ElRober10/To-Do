import { api } from '../services/api.js';
import { buttonStyles, formStyles } from '../styles/shared.js';

/** Escapa texto de usuario antes de insertarlo en innerHTML, para evitar XSS. */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

export class TaskModal extends HTMLElement {
  #task = null;

  /** Asigna la tarea a editar (o null en modo creación) y repinta el formulario. */
  set task(value) {
    this.#task = value;
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
        .checklist-items li span { flex: 1; font-size: 13px; color: var(--color-text); }
        .checklist-items li span.done { text-decoration: line-through; color: var(--color-text-secondary); }
        .checklist-items button { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }
        .checklist-items button:hover { color: var(--color-danger); }
        .checklist-add { display: flex; gap: 8px; margin-top: 4px; }
        .checklist-add input { flex: 1; }
        .checklist-add .btn { width: auto; white-space: nowrap; }
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
          ${t.id ? this.renderChecklist(t.checklistItems ?? []) : ''}
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
      const data = Object.fromEntries(new FormData(form).entries());
      if (this.#task?.id) {
        data.id = this.#task.id;
      }
      this.dispatchEvent(new CustomEvent('task-save', { detail: data, bubbles: true, composed: true }));
    });

    this.shadowRoot.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true, composed: true }));
    });

    if (t.id) {
      this.wireChecklistEvents();
    }
  }

  /** HTML de la sección de checklist: lista de pasos + mini-formulario para añadir uno nuevo. */
  renderChecklist(items) {
    return `
      <label>Checklist</label>
      <ul class="checklist-items">
        ${items.map((item) => `
          <li data-id="${item.id}">
            <input type="checkbox" data-action="toggle-item" ${item.completed ? 'checked' : ''}>
            <span class="${item.completed ? 'done' : ''}">${escapeHtml(item.text)}</span>
            <button type="button" data-action="delete-item" aria-label="Borrar paso">&times;</button>
          </li>
        `).join('')}
      </ul>
      <div class="checklist-add" data-role="add-item-form">
        <input type="text" placeholder="Nuevo paso" data-role="new-item-text">
        <button type="button" class="btn btn-secondary" data-action="add-item">Añadir</button>
      </div>
    `;
  }

  /** Engancha los eventos de la checklist: marcar, borrar, añadir. Cada acción llama a la API al instante (no espera a "Guardar"). */
  wireChecklistEvents() {
    this.shadowRoot.querySelectorAll('[data-action="toggle-item"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const id = Number(checkbox.closest('li').dataset.id);
        this.toggleChecklistItem(id, checkbox.checked);
      });
    });

    this.shadowRoot.querySelectorAll('[data-action="delete-item"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.closest('li').dataset.id);
        this.deleteChecklistItem(id);
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

  /** Añade un paso nuevo, lo guarda en la API y repinta (con foco de nuevo en el campo, para poder seguir añadiendo). */
  async addChecklistItem() {
    const input = this.shadowRoot.querySelector('[data-role="new-item-text"]');
    const text = input.value.trim();
    if (!text) return;

    const { item } = await api.createChecklistItem(this.#task.id, text);
    this.#task = { ...this.#task, checklistItems: [...(this.#task.checklistItems ?? []), item] };
    this.notifyChecklistChange();
    this.render();
    this.shadowRoot.querySelector('[data-role="new-item-text"]')?.focus();
  }

  /** Marca/desmarca un paso como completado. */
  async toggleChecklistItem(id, completed) {
    const current = this.#task.checklistItems.find((i) => i.id === id);
    const { item } = await api.updateChecklistItem(id, { text: current.text, completed });
    this.#task = {
      ...this.#task,
      checklistItems: this.#task.checklistItems.map((i) => (i.id === id ? item : i)),
    };
    this.notifyChecklistChange();
    this.render();
  }

  /** Borra un paso de la checklist. */
  async deleteChecklistItem(id) {
    await api.deleteChecklistItem(id);
    this.#task = {
      ...this.#task,
      checklistItems: this.#task.checklistItems.filter((i) => i.id !== id),
    };
    this.notifyChecklistChange();
    this.render();
  }

  /** Avisa hacia fuera (a app-board) de que la checklist cambió, para que la tarjeta detrás del modal se actualice sin esperar a cerrar. */
  notifyChecklistChange() {
    this.dispatchEvent(new CustomEvent('checklist-change', {
      detail: { taskId: this.#task.id, checklistItems: this.#task.checklistItems },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('task-modal', TaskModal);
