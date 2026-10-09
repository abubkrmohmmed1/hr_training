/**
 * Page module: Login and authentication.
 */
import { API } from '../modules/api.js';
import { Auth } from '../modules/auth.js';
import { $, $$ } from '../modules/ui.js';

export async function initLoginPage() {
  if (Auth.isLoggedIn()) {
    Auth.redirectToDashboard();
    return;
  }
  const form = $('#login-form');
  const error = $('#login-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.style.display = 'none';
    const email = $('#email').value.trim();
    const password = $('#password').value;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const data = await API.login(email, password);
      Auth.setSession(data.user);
      Auth.redirectToDashboard();
    } catch (err) {
      error.textContent = err.message;
      error.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  });
  $$('.demo-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $('#email').value = chip.dataset.email;
      $('#password').value = '123456';
    });
  });
}
