import { buttonStyles, formStyles } from '../styles/shared.js';

/**
 * Base común a login-form y register-form: mismo Shadow DOM, mismo manejo
 * de submit/error. Cada subclase solo define fieldsHtml(), submitLabel() y
 * submit(data) (la llamada a la API concreta).
 */
export class AuthFormBase extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  /** HTML de los <input> del formulario. Lo define cada subclase. */
  fieldsHtml() {
    throw new Error('fieldsHtml() debe implementarse en la subclase');
  }

  /** Texto del botón de envío. Lo define cada subclase. */
  submitLabel() {
    throw new Error('submitLabel() debe implementarse en la subclase');
  }

  /** Llama a la API con los datos del formulario y devuelve { user }. Lo define cada subclase. */
  async submit(data) {
    throw new Error('submit() debe implementarse en la subclase');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${buttonStyles}
        ${formStyles}
        :host { display: block; font-family: system-ui, sans-serif; }
        form { display: flex; flex-direction: column; gap: 14px; }
        button { width: 100%; margin-top: 8px; }
        .error { color: var(--color-danger); font-size: 12px; margin: 4px 0 0; }
      </style>
      <form>
        ${this.fieldsHtml()}
        <p class="error" hidden></p>
        <button type="submit" class="btn btn-primary">${this.submitLabel()}</button>
      </form>
    `;

    const form = this.shadowRoot.querySelector('form');
    const error = this.shadowRoot.querySelector('.error');

    /** Al enviar: intenta la acción concreta; si falla, muestra el error del backend. */
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());

      try {
        const { user } = await this.submit(data);
        this.dispatchEvent(new CustomEvent('auth-success', { detail: { user }, bubbles: true, composed: true }));
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
  }
}
