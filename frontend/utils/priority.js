const LABELS = { low: 'Baja', medium: 'Media', high: 'Alta' };
const WEIGHTS = { high: 0, medium: 1, low: 2 };

/** Traduce el valor interno de prioridad ('low'/'medium'/'high') a la etiqueta en español. */
export function priorityLabel(priority) {
  return LABELS[priority] ?? priority;
}

/** Peso numérico para ordenar tareas por prioridad (alta = 0, la más "pesada" para ordenar primero). */
export function priorityWeight(priority) {
  return WEIGHTS[priority] ?? 99;
}
