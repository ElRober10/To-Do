import { api } from '../services/api.js';
import { AuthFormBase } from './auth-form-base.js';

export class LoginForm extends AuthFormBase {
  fieldsHtml() {
    return `
      <input name="email" type="email" placeholder="Email" autocomplete="email" required>
      <input name="password" type="password" placeholder="Contraseña" autocomplete="current-password" required>
    `;
  }

  submitLabel() {
    return 'Entrar';
  }

  submit(data) {
    return api.login(data.email, data.password);
  }
}

customElements.define('login-form', LoginForm);
