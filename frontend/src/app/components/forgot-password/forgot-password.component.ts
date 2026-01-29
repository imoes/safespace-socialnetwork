import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="forgot-password-container">
      <div class="forgot-password-card">
        <h1>{{ 'passwordReset.title' | translate }}</h1>
        <p class="subtitle">{{ 'passwordReset.subtitle' | translate }}</p>

        @if (error) { <div class="error">{{ error }}</div> }
        @if (success) { <div class="success">{{ success }}</div> }

        @if (!success) {
          <form (ngSubmit)="requestReset()">
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              [placeholder]="'passwordReset.email' | translate"
              required
            />
            <button type="submit" [disabled]="isLoading">
              {{ isLoading ? '...' : ('passwordReset.sendLink' | translate) }}
            </button>
          </form>
        }

        <p class="link">
          <a routerLink="/login">{{ 'passwordReset.backToLogin' | translate }}</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .forgot-password-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea, #764ba2);
    }

    .forgot-password-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      width: 100%;
      max-width: 400px;
    }

    h1 {
      margin: 0 0 8px;
      text-align: center;
      color: #1877f2;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .error {
      background: #ffebee;
      color: #c62828;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 16px;
    }

    .success {
      background: #e8f5e9;
      color: #2e7d32;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 16px;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    input {
      padding: 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
    }

    input:focus {
      outline: none;
      border-color: #1877f2;
    }

    button {
      padding: 14px;
      background: #1877f2;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #166fe5;
    }

    button:disabled {
      background: #ccc;
    }

    .link {
      text-align: center;
      margin-top: 20px;
    }

    .link a {
      color: #1877f2;
      text-decoration: none;
    }

    @media (max-width: 1024px) {
      .forgot-password-container { padding: 16px; }
      .forgot-password-card { padding: 28px 20px; }
    }
  `]
})
export class ForgotPasswordComponent {
  private http = inject(HttpClient);
  public i18n = inject(I18nService);

  email = '';
  error = '';
  success = '';
  isLoading = false;

  requestReset(): void {
    if (!this.email) {
      this.error = this.i18n.t('passwordReset.errors.emailRequired');
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.http.post<{ message: string }>('/api/auth/password-reset/request', {
      email: this.email
    }).subscribe({
      next: () => {
        this.success = this.i18n.t('passwordReset.success');
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Password reset request failed:', err);
        this.error = this.i18n.t('passwordReset.errors.resetFailed');
        this.isLoading = false;
      }
    });
  }
}
