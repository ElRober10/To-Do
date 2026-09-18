/** Estilos de botones e inputs para pegar dentro del <style> de cada componente (el CSS no atraviesa el Shadow DOM, solo las variables). */
export const buttonStyles = `
  .btn {
    font: inherit;
    font-weight: 600;
    font-size: 13px;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .08s ease;
  }
  .btn:active { transform: scale(.96); }
  .btn-primary { background: var(--color-primary); color: var(--color-primary-contrast); }
  .btn-primary:hover { background: var(--color-primary-hover); }
  .btn-secondary { background: transparent; color: var(--color-text); border-color: var(--color-border); }
  .btn-secondary:hover { background: var(--color-surface-hover); }
`;

export const formStyles = `
  label {
    display: block;
    font-size: 12px;
    margin: 12px 0 4px;
    color: var(--color-text-secondary);
  }
  input:not([type="checkbox"]), textarea, select {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
  }
  input:focus, textarea:focus, select:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }
`;
