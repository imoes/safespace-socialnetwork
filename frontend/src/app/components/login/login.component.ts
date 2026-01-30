import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>{{ siteTitle() }}</h1>
        <p class="subtitle">{{ 'login.subtitle' | translate }}</p>
        @if (error) { <div class="error">{{ error }}</div> }
        <form (ngSubmit)="login()">
          <input type="text" [(ngModel)]="username" name="username" autocomplete="username" [placeholder]="'login.username' | translate" required />
          <input type="password" [(ngModel)]="password" name="password" autocomplete="current-password" [placeholder]="'login.password' | translate" required />
          <button type="submit" [disabled]="isLoading">{{ isLoading ? '...' : ('login.loginButton' | translate) }}</button>
        </form>
        <p class="forgot-password"><a routerLink="/forgot-password">{{ 'login.forgotPassword' | translate }}</a></p>
        <p class="link">{{ 'login.noAccount' | translate }} <a routerLink="/register">{{ 'login.register' | translate }}</a></p>
        <p class="impressum-link"><a routerLink="/impressum">{{ 'nav.impressum' | translate }}</a></p>
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
    .forgot-password { text-align: center; margin-top: 16px; font-size: 13px; }
    .forgot-password a { color: #1877f2; text-decoration: none; }
    .forgot-password a:hover { text-decoration: underline; }
    .link { text-align: center; margin-top: 12px; }
    .link a { color: #1877f2; text-decoration: none; }
    .impressum-link { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #999; }
    .impressum-link a { color: #999; text-decoration: none; }
    .impressum-link a:hover { color: #1877f2; text-decoration: underline; }

    @media (max-width: 1024px) {
      .login-container { padding: 16px; }
      .login-card { padding: 28px 20px; }
    }
  `]
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  siteTitle = signal('SafeSpace');
  username = '';
  password = '';
  error = '';
  isLoading = false;

  ngOnInit(): void {
    this.http.get<{ site_title: string }>('/api/site-settings/title').subscribe({
      next: (res) => { if (res.site_title) this.siteTitle.set(res.site_title); },
      error: () => {}
    });
  }

  login(): void {
    this.isLoading = true;
    this.error = '';
    this.authService.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => { this.error = err.error?.detail || this.i18n.t('login.errors.loginFailed'); this.isLoading = false; }
    });
  }
}
