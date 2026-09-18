const LABELS = { low: 'Baja', medium: 'Media', high: 'Alta' };
const WEIGHTS = { high: 0, medium: 1, low: 2 };
const COLORS = { high: '#dc2626', medium: '#d97706', low: '#16a34a' };

/** Traduce el valor interno de prioridad ('low'/'medium'/'high') a la etiqueta en español. */
export function priorityLabel(priority) {
  return LABELS[priority] ?? priority;
}

/** Color por defecto asociado a la prioridad, usado como borde de la tarjeta. */
export function priorityColor(priority) {
  return COLORS[priority] ?? '#dfe1e6';
}

/** Peso numérico para ordenar tareas por prioridad (alta = 0, la más "pesada" para ordenar primero). */
export function priorityWeight(priority) {
  return WEIGHTS[priority] ?? 99;
}
