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
    const t = this.#task ?? { title: '', description: '', priority: 'medium', color: '#4f46e5', dueDate: '' };

    this.shadowRoot.innerHTML = `
      <style>
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 8px; padding: 24px; width: min(420px, 90vw); animation: pop .15s ease; }
        @keyframes pop { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        label { display: block; font-size: 12px; margin: 12px 0 4px; }
        input, textarea, select { width: 100%; padding: 8px; border: 1px solid #dfe1e6; border-radius: 4px; font: inherit; }
        .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
        button { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; }
        button[type="submit"] { background: #4f46e5; color: #fff; }
      </style>
      <div class="overlay">
        <form class="modal">
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
          <label>Color<input type="color" name="color" value="${escapeHtml(t.color ?? '#4f46e5')}"></label>
          <div class="actions">
            <button type="button" data-action="cancel">Cancelar</button>
            <button type="submit">Guardar</button>
          </div>
        </form>
      </div>
    `;

    const form = this.shadowRoot.querySelector('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      this.dispatchEvent(new CustomEvent('task-save', { detail: data, bubbles: true, composed: true }));
    });

    this.shadowRoot.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true, composed: true }));
    });
  }
}

customElements.define('task-modal', TaskModal);
