import { api } from '../services/api.js';
import { buttonStyles, formStyles } from '../styles/shared.js';

export class LoginForm extends HTMLElement {
  /** Prepara el Shadow DOM y pinta el formulario. */
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  /** Pinta el formulario de login con su mensaje de error oculto. */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${buttonStyles}
        ${formStyles}
        :host { display: block; font-family: system-ui, sans-serif; }
        form { display: flex; flex-direction: column; gap: 4px; }
        input { margin-bottom: 4px; }
        button { width: 100%; margin-top: 8px; }
        .error { color: var(--color-danger); font-size: 12px; margin: 4px 0 0; }
      </style>
      <form>
        <input name="email" type="email" placeholder="Email" autocomplete="email" required>
        <input name="password" type="password" placeholder="Contraseña" autocomplete="current-password" required>
        <p class="error" hidden></p>
        <button type="submit" class="btn btn-primary">Entrar</button>
      </form>
    `;

    const form = this.shadowRoot.querySelector('form');
    const error = this.shadowRoot.querySelector('.error');

    /** Al enviar: intenta login; si falla, muestra el mensaje de error del backend. */
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());

      try {
        const { user } = await api.login(data.email, data.password);
        this.dispatchEvent(new CustomEvent('auth-success', { detail: { user }, bubbles: true, composed: true }));
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
  }
}

customElements.define('login-form', LoginForm);
