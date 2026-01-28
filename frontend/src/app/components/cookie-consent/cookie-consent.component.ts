import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';

const CONSENT_KEY = 'cookie_consent_accepted';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    @if (showBanner()) {
      <div class="cookie-banner">
        <div class="cookie-content">
          <div class="cookie-text">
            <strong>{{ 'cookie.title' | translate }}</strong>
            <p>{{ 'cookie.message' | translate }}</p>
            <ul class="cookie-list">
              <li>{{ 'cookie.essential' | translate }}</li>
            </ul>
            <p class="cookie-note">{{ 'cookie.noTracking' | translate }}</p>
          </div>
          <div class="cookie-actions">
            <button class="btn btn-accept" (click)="accept()">
              {{ 'cookie.accept' | translate }}
            </button>
            <a routerLink="/privacy-policy" class="btn btn-link" (click)="accept()">
              {{ 'cookie.moreInfo' | translate }}
            </a>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cookie-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1c1e21;
      color: #e4e6e9;
      z-index: 9999;
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.4s ease;
    }

    .cookie-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .cookie-text {
      flex: 1;
    }

    .cookie-text strong {
      font-size: 16px;
      color: white;
    }

    .cookie-text p {
      margin: 8px 0 0 0;
      font-size: 13px;
      line-height: 1.5;
      color: #b0b3b8;
    }

    .cookie-list {
      margin: 8px 0;
      padding-left: 20px;
      font-size: 13px;
      color: #b0b3b8;
    }

    .cookie-list li {
      margin: 4px 0;
    }

    .cookie-note {
      font-size: 12px;
      color: #8a8d91;
      font-style: italic;
    }

    .cookie-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-accept {
      padding: 10px 28px;
      background: #1877f2;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      white-space: nowrap;
    }

    .btn-accept:hover {
      background: #155db2;
    }

    .btn-link {
      padding: 6px 12px;
      color: #b0b3b8;
      text-decoration: none;
      font-size: 13px;
      text-align: center;
      transition: color 0.2s;
    }

    .btn-link:hover {
      color: white;
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .cookie-content {
        flex-direction: column;
        padding: 16px;
        gap: 16px;
      }

      .cookie-actions {
        flex-direction: row;
        width: 100%;
      }

      .btn-accept {
        flex: 1;
      }
    }
  `]
})
export class CookieConsentComponent {
  showBanner = signal(!localStorage.getItem(CONSENT_KEY));

  accept(): void {
    localStorage.setItem(CONSENT_KEY, 'true');
    this.showBanner.set(false);
  }
}
