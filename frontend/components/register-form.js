import { api } from '../services/api.js';
import { AuthFormBase } from './auth-form-base.js';

export class RegisterForm extends AuthFormBase {
  fieldsHtml() {
    return `
      <input name="name" placeholder="Nombre" autocomplete="name" required>
      <input name="email" type="email" placeholder="Email" autocomplete="email" required>
      <input name="password" type="password" placeholder="Contraseña (mín. 6)" autocomplete="new-password" required minlength="6">
    `;
  }

  submitLabel() {
    return 'Registrarme';
  }

  submit(data) {
    return api.register(data.name, data.email, data.password);
  }
}

customElements.define('register-form', RegisterForm);
