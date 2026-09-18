const BASE_URL = '/api';

/** Hace fetch a la API, añade la cookie de sesión y lanza Error con el mensaje del backend si falla. */
async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error de red');
  }

  return data;
}

export const api = {
  /** Crea una cuenta nueva y deja al usuario logueado. */
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  /** Inicia sesión con email y contraseña. */
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  /** Cierra la sesión actual. */
  logout: () => request('/auth/logout', { method: 'POST' }),

  /** Devuelve el usuario logueado, o null si no hay sesión. */
  me: () => request('/auth/me'),

  /** Lista los tableros del usuario logueado. */
  listBoards: () => request('/boards'),

  /** Crea un tablero nuevo. */
  createBoard: (name) =>
    request('/boards', { method: 'POST', body: JSON.stringify({ name }) }),

  /** Lista las tareas de un tablero. */
  listTasks: (boardId) => request(`/boards/${boardId}/tasks`),

  /** Crea una tarea nueva. */
  createTask: (data) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  /** Edita el contenido de una tarea. */
  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  /** Mueve una tarea de columna/posición (lo llama el drag&drop). */
  moveTask: (id, status, position) =>
    request(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, position }) }),

  /** Borra una tarea. */
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  /** Añade un paso nuevo a la checklist de una tarea. */
  createChecklistItem: (taskId, text) =>
    request(`/tasks/${taskId}/checklist-items`, { method: 'POST', body: JSON.stringify({ text }) }),

  /** Edita el texto y/o marca/desmarca un paso de checklist. */
  updateChecklistItem: (id, data) =>
    request(`/checklist-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  /** Borra un paso de checklist. */
  deleteChecklistItem: (id) => request(`/checklist-items/${id}`, { method: 'DELETE' }),
};
