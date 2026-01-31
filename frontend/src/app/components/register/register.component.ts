import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
        @if (verificationPending) {
          <div class="consent-pending">
            <h3>{{ 'register.verificationPending' | translate }}</h3>
            <p>{{ 'register.verificationPendingHint' | translate }}</p>
            @if (consentPending) {
              <p style="margin-top: 12px; font-weight: 600;">{{ 'register.consentPendingHint' | translate }}</p>
            }
            <button class="resend-btn" (click)="resendVerification()" [disabled]="resendCooldown > 0">
              {{ resendCooldown > 0 ? ('register.resendIn' | translate) + ' ' + resendCooldown + 's' : ('register.resendVerification' | translate) }}
            </button>
          </div>
        } @else {
          <form (ngSubmit)="register()">
            <input type="text" [(ngModel)]="username" name="username" autocomplete="username" [placeholder]="'register.username' | translate" required minlength="3" />
            <input type="text" [(ngModel)]="firstName" name="firstName" autocomplete="given-name" [placeholder]="'settings.firstName' | translate" />
            <input type="text" [(ngModel)]="lastName" name="lastName" autocomplete="family-name" [placeholder]="'settings.lastName' | translate" />
            <input type="email" [(ngModel)]="email" name="email" autocomplete="email" [placeholder]="'register.email' | translate" required />
            <div class="birthday-field">
              <label>{{ 'register.birthday' | translate }} <span class="required">*</span></label>
              <input type="date" [(ngModel)]="birthday" name="birthday" autocomplete="bday" required (change)="onBirthdayChange()" />
            </div>
            @if (needsParentalConsent) {
              <div class="parental-info">
                <p>{{ 'register.parentalRequired' | translate }}</p>
                <input type="email" [(ngModel)]="parentEmail" name="parentEmail" [placeholder]="'register.parentEmail' | translate" required />
              </div>
            }
            @if (tooYoung) {
              <div class="age-blocked">
                {{ 'register.tooYoung' | translate }}
              </div>
            }
            <input type="password" [(ngModel)]="password" name="password" autocomplete="new-password" [placeholder]="'register.password' | translate" required minlength="6" />
            <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" autocomplete="new-password" [placeholder]="'register.confirmPassword' | translate" required />
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="agbAccepted" name="agbAccepted" />
              <span>{{ 'register.agbAccept' | translate }} <a routerLink="/terms" target="_blank">{{ 'register.agbLink' | translate }}</a> {{ 'register.agbAnd' | translate }} <a routerLink="/privacy-policy" target="_blank">{{ 'register.privacyLink' | translate }}</a>.</span>
            </label>
            <button type="submit" [disabled]="isLoading || !agbAccepted || tooYoung || !birthday">{{ isLoading ? '...' : ('register.registerButton' | translate) }}</button>
          </form>
        }
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
    .birthday-field .required { color: #c62828; font-weight: bold; }
    .birthday-field input { padding: 12px 14px; }
    .parental-info { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 14px; }
    .parental-info p { margin: 0 0 10px; font-size: 13px; color: #856404; line-height: 1.5; }
    .parental-info input { width: 100%; box-sizing: border-box; }
    .age-blocked { background: #ffebee; border: 1px solid #ef9a9a; border-radius: 8px; padding: 14px; color: #c62828; font-size: 14px; text-align: center; font-weight: 600; }
    .consent-pending { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 20px; text-align: center; }
    .consent-pending h3 { margin: 0 0 8px; color: #1565c0; }
    .consent-pending p { margin: 0; color: #1976d2; font-size: 14px; line-height: 1.5; }
    .resend-btn { margin-top: 16px; padding: 10px 20px; background: #1877f2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .resend-btn:disabled { background: #ccc; cursor: not-allowed; }
    button { padding: 14px; background: #42b72a; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .checkbox-label { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #555; line-height: 1.4; }
    .checkbox-label input[type="checkbox"] { margin-top: 2px; flex-shrink: 0; }
    .checkbox-label a { color: #1877f2; text-decoration: none; }
    .checkbox-label a:hover { text-decoration: underline; }
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
  private http = inject(HttpClient);
  public i18n = inject(I18nService);

  username = '';
  firstName = '';
  lastName = '';
  email = '';
  birthday = '';
  parentEmail = '';
  password = '';
  confirmPassword = '';
  agbAccepted = false;
  error = '';
  success = '';
  isLoading = false;
  needsParentalConsent = false;
  tooYoung = false;
  consentPending = false;
  verificationPending = false;
  resendCooldown = 0;

  onBirthdayChange(): void {
    if (!this.birthday) {
      this.needsParentalConsent = false;
      this.tooYoung = false;
      return;
    }

    const birth = new Date(this.birthday);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    this.tooYoung = age < 13;
    this.needsParentalConsent = age >= 13 && age < 16;

    if (!this.needsParentalConsent) {
      this.parentEmail = '';
    }
  }

  register(): void {
    if (this.password !== this.confirmPassword) {
      this.error = this.i18n.t('register.errors.passwordMismatch');
      return;
    }

    if (!this.birthday) {
      this.error = this.i18n.t('register.errors.birthdayRequired');
      return;
    }

    if (this.needsParentalConsent && !this.parentEmail) {
      this.error = this.i18n.t('register.errors.parentEmailRequired');
      return;
    }

    this.isLoading = true;
    this.error = '';

    const body: any = {
      username: this.username,
      email: this.email,
      password: this.password,
      first_name: this.firstName,
      last_name: this.lastName,
      birthday: this.birthday || null
    };
    if (this.needsParentalConsent && this.parentEmail) {
      body.parent_email = this.parentEmail;
    }

    this.http.post('/api/auth/register', body).subscribe({
      next: () => {
        this.verificationPending = true;
        if (this.needsParentalConsent) {
          this.consentPending = true;
        }
        this.isLoading = false;
      },
      error: (err) => {
        const detail = err.error?.detail;

        if (typeof detail === 'string') {
          if (detail === 'Username already registered') {
            this.error = this.i18n.t('register.errors.usernameAlreadyRegistered');
          } else if (detail === 'Email already registered') {
            this.error = this.i18n.t('register.errors.emailAlreadyRegistered');
          } else if (detail === 'Minimum age is 13') {
            this.error = this.i18n.t('register.tooYoung');
          } else if (detail === 'Parental consent required') {
            this.error = this.i18n.t('register.errors.parentEmailRequired');
          } else if (detail === 'Parent email must be different from your own email') {
            this.error = this.i18n.t('register.errors.parentEmailSame');
          } else {
            this.error = detail;
          }
        } else if (Array.isArray(detail)) {
          const messages = detail.map((d: any) => d.msg || JSON.stringify(d));
          this.error = messages.join(', ');
        } else {
          this.error = this.i18n.t('register.errors.registrationFailed');
        }

        this.isLoading = false;
      }
    });
  }

  resendVerification(): void {
    this.resendCooldown = 60;
    const interval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    this.http.post('/api/auth/resend-verification', { email: this.email }).subscribe();
  }
}
