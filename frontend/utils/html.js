/** Escapa texto de usuario antes de insertarlo en innerHTML, para evitar XSS. */
export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
