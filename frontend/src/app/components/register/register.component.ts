import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h1>Registrieren</h1>
        <p class="subtitle">Erstelle dein Konto</p>
        @if (error) { <div class="error">{{ error }}</div> }
        @if (success) { <div class="success">{{ success }}</div> }
        <form (ngSubmit)="register()">
          <input type="text" [(ngModel)]="username" name="username" placeholder="Benutzername" required minlength="3" />
          <input type="email" [(ngModel)]="email" name="email" placeholder="E-Mail" required />
          <input type="password" [(ngModel)]="password" name="password" placeholder="Passwort" required minlength="6" />
          <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" placeholder="Passwort bestätigen" required />
          <button type="submit" [disabled]="isLoading">{{ isLoading ? '...' : 'Registrieren' }}</button>
        </form>
        <p class="link">Bereits ein Konto? <a routerLink="/login">Anmelden</a></p>
      </div>
    </div>
  `,
  styles: [`
    .register-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea, #764ba2); }
    .register-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
    h1 { margin: 0 0 8px; text-align: center; color: #1877f2; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    .error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    .success { background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    input { padding: 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    input:focus { outline: none; border-color: #1877f2; }
    button { padding: 14px; background: #42b72a; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:disabled { background: #ccc; }
    .link { text-align: center; margin-top: 20px; }
    .link a { color: #1877f2; text-decoration: none; }
  `]
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  success = '';
  isLoading = false;

  register(): void {
    console.log('🔵 Registration gestartet');
    
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwörter stimmen nicht überein';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.register(this.username, this.email, this.password).subscribe({
      next: () => {
        console.log('✅ Registration erfolgreich, Token gespeichert!');
        this.success = 'Registrierung erfolgreich! Weiterleitung...';
        
        setTimeout(() => {
          console.log('🔄 Navigiere zu Feed...');
          this.router.navigate(['/']);
        }, 1000);
      },
      error: (err) => {
        console.error('❌ Registration fehlgeschlagen:', err);
        this.error = err.error?.detail || 'Registrierung fehlgeschlagen';
        this.isLoading = false;
      }
    });
  }
}
