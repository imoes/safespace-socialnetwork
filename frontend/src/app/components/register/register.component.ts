import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h1>{{ 'register.title' | translate }}</h1>
        <p class="subtitle">{{ 'login.subtitle' | translate }}</p>
        @if (error) { <div class="error">{{ error }}</div> }
        @if (success) { <div class="success">{{ success }}</div> }
        <form (ngSubmit)="register()">
          <input type="text" [(ngModel)]="username" name="username" [placeholder]="'register.username' | translate" required minlength="3" />
          <input type="text" [(ngModel)]="firstName" name="firstName" [placeholder]="'settings.firstName' | translate" />
          <input type="text" [(ngModel)]="lastName" name="lastName" [placeholder]="'settings.lastName' | translate" />
          <input type="email" [(ngModel)]="email" name="email" [placeholder]="'register.email' | translate" required />
          <div class="birthday-field">
            <label>{{ 'register.birthday' | translate }} <span class="optional">({{ 'register.optional' | translate }})</span></label>
            <input type="date" [(ngModel)]="birthday" name="birthday" />
          </div>
          <input type="password" [(ngModel)]="password" name="password" [placeholder]="'register.password' | translate" required minlength="6" />
          <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" [placeholder]="'register.confirmPassword' | translate" required />
          <button type="submit" [disabled]="isLoading">{{ isLoading ? '...' : ('register.registerButton' | translate) }}</button>
        </form>
        <p class="link">{{ 'register.hasAccount' | translate }} <a routerLink="/login">{{ 'register.login' | translate }}</a></p>
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
    .birthday-field { display: flex; flex-direction: column; gap: 4px; }
    .birthday-field label { font-size: 14px; color: #333; }
    .birthday-field .optional { color: #888; font-size: 12px; }
    .birthday-field input { padding: 12px 14px; }
    button { padding: 14px; background: #42b72a; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:disabled { background: #ccc; }
    .link { text-align: center; margin-top: 20px; }
    .link a { color: #1877f2; text-decoration: none; }

    @media (max-width: 1024px) {
      .register-container { padding: 16px; }
      .register-card { padding: 28px 20px; }
    }
  `]
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  public i18n = inject(I18nService);

  username = '';
  firstName = '';
  lastName = '';
  email = '';
  birthday = '';
  password = '';
  confirmPassword = '';
  error = '';
  success = '';
  isLoading = false;

  register(): void {
    console.log('🔵 Registration gestartet');

    if (this.password !== this.confirmPassword) {
      this.error = this.i18n.t('register.errors.passwordMismatch');
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.register(this.username, this.email, this.password, this.firstName, this.lastName, this.birthday || undefined).subscribe({
      next: () => {
        console.log('✅ Registration erfolgreich, Token gespeichert!');
        this.success = this.i18n.t('register.success');

        setTimeout(() => {
          console.log('🔄 Navigiere zu Feed...');
          this.router.navigate(['/']);
        }, 1000);
      },
      error: (err) => {
        console.error('Registration failed:', err);

        const detail = err.error?.detail;

        if (typeof detail === 'string') {
          if (detail === 'Username already registered') {
            this.error = this.i18n.t('register.errors.usernameAlreadyRegistered');
          } else if (detail === 'Email already registered') {
            this.error = this.i18n.t('register.errors.emailAlreadyRegistered');
          } else {
            this.error = detail;
          }
        } else if (Array.isArray(detail)) {
          // Pydantic validation errors (422)
          const messages = detail.map((d: any) => d.msg || JSON.stringify(d));
          this.error = messages.join(', ');
        } else {
          this.error = this.i18n.t('register.errors.registrationFailed');
        }

        this.isLoading = false;
      }
    });
  }
}
