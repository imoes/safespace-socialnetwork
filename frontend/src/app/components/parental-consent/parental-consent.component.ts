import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-parental-consent',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="consent-container">
      <div class="consent-card">
        <h1>SafeSpace</h1>
        @if (loading) {
          <div class="loading">{{ 'parentalConsent.verifying' | translate }}</div>
        } @else if (confirmed) {
          <div class="success-box">
            <h2>{{ 'parentalConsent.confirmedTitle' | translate }}</h2>
            <p>{{ 'parentalConsent.confirmedMessage' | translate }}</p>
          </div>
        } @else if (alreadyConfirmed) {
          <div class="info-box">
            <h2>{{ 'parentalConsent.alreadyConfirmedTitle' | translate }}</h2>
            <p>{{ 'parentalConsent.alreadyConfirmedMessage' | translate }}</p>
          </div>
        } @else if (error) {
          <div class="error-box">
            <h2>{{ 'parentalConsent.errorTitle' | translate }}</h2>
            <p>{{ 'parentalConsent.errorMessage' | translate }}</p>
          </div>
        }
        <p class="link"><a routerLink="/login">{{ 'parentalConsent.backToLogin' | translate }}</a></p>
      </div>
    </div>
  `,
  styles: [`
    .consent-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea, #764ba2); }
    .consent-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 500px; text-align: center; }
    h1 { margin: 0 0 24px; color: #1877f2; }
    .loading { padding: 20px; color: #666; }
    .success-box { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 8px; padding: 24px; }
    .success-box h2 { margin: 0 0 8px; color: #2e7d32; font-size: 20px; }
    .success-box p { margin: 0; color: #388e3c; line-height: 1.5; }
    .info-box { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 24px; }
    .info-box h2 { margin: 0 0 8px; color: #1565c0; font-size: 20px; }
    .info-box p { margin: 0; color: #1976d2; line-height: 1.5; }
    .error-box { background: #ffebee; border: 1px solid #ef9a9a; border-radius: 8px; padding: 24px; }
    .error-box h2 { margin: 0 0 8px; color: #c62828; font-size: 20px; }
    .error-box p { margin: 0; color: #d32f2f; line-height: 1.5; }
    .link { margin-top: 20px; }
    .link a { color: #1877f2; text-decoration: none; font-weight: 600; }
    .link a:hover { text-decoration: underline; }
  `]
})
export class ParentalConsentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  public i18n = inject(I18nService);

  loading = true;
  confirmed = false;
  alreadyConfirmed = false;
  error = false;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error = true;
      this.loading = false;
      return;
    }

    this.http.get<any>(`/api/auth/parental-consent/${token}`).subscribe({
      next: (response) => {
        if (response.already_confirmed) {
          this.alreadyConfirmed = true;
        } else {
          this.confirmed = true;
        }
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }
}
