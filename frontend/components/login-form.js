import { api } from '../services/api.js';

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
        form { max-width: 320px; margin: 64px auto; display: flex; flex-direction: column; gap: 8px; }
        input { padding: 8px; border: 1px solid #dfe1e6; border-radius: 4px; }
        button { padding: 8px; background: #4f46e5; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        .error { color: #b91c1c; font-size: 12px; }
      </style>
      <form>
        <h2>Iniciar sesión</h2>
        <input name="email" type="email" placeholder="Email" autocomplete="email" required>
        <input name="password" type="password" placeholder="Contraseña" autocomplete="current-password" required>
        <p class="error" hidden></p>
        <button type="submit">Entrar</button>
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
