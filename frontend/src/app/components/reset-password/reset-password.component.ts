import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="reset-password-container">
      <div class="reset-password-card">
        <h1>{{ 'passwordReset.title' | translate }}</h1>

        @if (isValidating) {
          <div class="loading">
            <div class="spinner"></div>
            <p>Validating...</p>
          </div>
        } @else if (tokenInvalid) {
          <div class="error">{{ 'passwordReset.invalidToken' | translate }}</div>
          <p class="link">
            <a routerLink="/forgot-password">{{ 'passwordReset.sendLink' | translate }}</a>
          </p>
        } @else if (success) {
          <div class="success">{{ 'passwordReset.resetSuccess' | translate }}</div>
          <p class="link">
            <a routerLink="/login">{{ 'passwordReset.backToLogin' | translate }}</a>
          </p>
        } @else {
          @if (error) { <div class="error">{{ error }}</div> }

          <form (ngSubmit)="resetPassword()">
            <input
              type="password"
              [(ngModel)]="newPassword"
              name="newPassword"
              [placeholder]="'passwordReset.newPassword' | translate"
              required
              minlength="6"
            />
            <input
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              [placeholder]="'passwordReset.confirmPassword' | translate"
              required
            />
            <button type="submit" [disabled]="isLoading">
              {{ isLoading ? '...' : ('passwordReset.resetButton' | translate) }}
            </button>
          </form>
        }

        @if (!success && !tokenInvalid) {
          <p class="link">
            <a routerLink="/login">{{ 'passwordReset.backToLogin' | translate }}</a>
          </p>
        }
      </div>
    </div>
  `,
  styles: [`
    .reset-password-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea, #764ba2);
    }

    .reset-password-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      width: 100%;
      max-width: 400px;
    }

    h1 {
      margin: 0 0 24px;
      text-align: center;
      color: #1877f2;
    }

    .loading {
      text-align: center;
      padding: 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f0f2f5;
      border-top-color: #1877f2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
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
      background: #42b72a;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #36a420;
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
      .reset-password-container { padding: 16px; }
      .reset-password-card { padding: 28px 20px; }
    }
  `]
})
export class ResetPasswordComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public i18n = inject(I18nService);

  token = '';
  newPassword = '';
  confirmPassword = '';
  error = '';
  success = false;
  tokenInvalid = false;
  isLoading = false;
  isValidating = true;

  ngOnInit(): void {
    // Token aus Query-Parameter lesen
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';

      if (!this.token) {
        this.tokenInvalid = true;
        this.isValidating = false;
        return;
      }

      // Token validieren
      this.validateToken();
    });
  }

  private validateToken(): void {
    this.http.get<{ valid: boolean }>(`/api/auth/password-reset/verify/${this.token}`).subscribe({
      next: () => {
        this.isValidating = false;
      },
      error: () => {
        this.tokenInvalid = true;
        this.isValidating = false;
      }
    });
  }

  resetPassword(): void {
    // Validierung
    if (this.newPassword.length < 6) {
      this.error = this.i18n.t('passwordReset.errors.passwordTooShort');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = this.i18n.t('passwordReset.errors.passwordMismatch');
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.http.post<{ message: string }>('/api/auth/password-reset/reset', {
      token: this.token,
      new_password: this.newPassword
    }).subscribe({
      next: () => {
        this.success = true;
        this.isLoading = false;

        // Nach 3 Sekunden zum Login weiterleiten
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        console.error('Password reset failed:', err);

        if (err.status === 400) {
          this.tokenInvalid = true;
        } else {
          this.error = this.i18n.t('passwordReset.errors.resetFailed');
        }

        this.isLoading = false;
      }
    });
  }
}
