/** Calcula la posición que debe tomar una tarea soltada en dropIndex, dadas las posiciones ya existentes en la columna. */
export function computeDropPosition(existingPositions, dropIndex) {
  if (existingPositions.length === 0) {
    return 0;
  }

  if (dropIndex >= existingPositions.length) {
    return Math.max(...existingPositions) + 1;
  }

  return existingPositions[dropIndex];
}
