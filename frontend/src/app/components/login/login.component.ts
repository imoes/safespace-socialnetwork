import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>SocialNet</h1>
        <p class="subtitle">Verbinde dich mit Freunden</p>
        @if (error) { <div class="error">{{ error }}</div> }
        <form (ngSubmit)="login()">
          <input type="text" [(ngModel)]="username" name="username" placeholder="Benutzername" required />
          <input type="password" [(ngModel)]="password" name="password" placeholder="Passwort" required />
          <button type="submit" [disabled]="isLoading">{{ isLoading ? '...' : 'Anmelden' }}</button>
        </form>
        <p class="link">Noch kein Konto? <a routerLink="/register">Registrieren</a></p>
      </div>
    </div>
  `,
  styles: [`
    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea, #764ba2); }
    .login-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
    h1 { margin: 0 0 8px; text-align: center; color: #1877f2; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    .error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    input { padding: 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    input:focus { outline: none; border-color: #1877f2; }
    button { padding: 14px; background: #1877f2; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:disabled { background: #ccc; }
    .link { text-align: center; margin-top: 20px; }
    .link a { color: #1877f2; text-decoration: none; }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  username = '';
  password = '';
  error = '';
  isLoading = false;

  login(): void {
    this.isLoading = true;
    this.error = '';
    this.authService.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => { this.error = err.error?.detail || 'Anmeldung fehlgeschlagen'; this.isLoading = false; }
    });
  }
}
