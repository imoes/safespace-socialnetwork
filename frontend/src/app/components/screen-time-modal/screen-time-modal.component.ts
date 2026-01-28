import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScreenTimeService } from '../../services/screen-time.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-screen-time-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    @if (screenTimeService.showBreakReminder()) {
      <div class="modal-overlay" (click)="dismissBreak()">
        <div class="modal-card break-modal" (click)="$event.stopPropagation()">
          <div class="modal-icon">&#9749;</div>
          <h3>{{ 'screenTime.breakTitle' | translate }}</h3>
          <p>{{ 'screenTime.breakMessage' | translate }}</p>
          <div class="modal-tips">
            <div class="tip">{{ 'screenTime.breakTip1' | translate }}</div>
            <div class="tip">{{ 'screenTime.breakTip2' | translate }}</div>
            <div class="tip">{{ 'screenTime.breakTip3' | translate }}</div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" (click)="dismissBreak()">
              {{ 'screenTime.dismissBreak' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (screenTimeService.showDailyLimitWarning()) {
      <div class="modal-overlay" (click)="dismissLimit()">
        <div class="modal-card limit-modal" (click)="$event.stopPropagation()">
          <div class="modal-icon">&#9203;</div>
          <h3>{{ 'screenTime.limitTitle' | translate }}</h3>
          <p>{{ 'screenTime.limitMessage' | translate: { minutes: screenTimeService.settings().daily_limit_minutes } }}</p>
          <p class="limit-hint">{{ 'screenTime.limitHint' | translate }}</p>
          <div class="modal-actions">
            <button class="btn btn-primary" (click)="dismissLimit()">
              {{ 'screenTime.dismissLimit' | translate }}
            </button>
            <a routerLink="/settings" class="btn btn-secondary" (click)="dismissLimit()">
              {{ 'screenTime.goToSettings' | translate }}
            </a>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    }

    .modal-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease;
    }

    .modal-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    h3 {
      margin: 0 0 12px 0;
      font-size: 20px;
      color: #1c1e21;
    }

    p {
      color: #65676b;
      font-size: 15px;
      line-height: 1.5;
      margin: 0 0 16px 0;
    }

    .modal-tips {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }

    .tip {
      padding: 10px 16px;
      background: #f0f7f0;
      border-radius: 8px;
      color: #2e7d32;
      font-size: 14px;
      text-align: left;
    }

    .limit-hint {
      font-size: 13px;
      color: #999;
      font-style: italic;
    }

    .limit-modal h3 {
      color: #e67e22;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }

    .btn-primary {
      background: #1877f2;
      color: white;
    }

    .btn-primary:hover {
      background: #155db2;
    }

    .btn-secondary {
      background: #f0f2f5;
      color: #666;
    }

    .btn-secondary:hover {
      background: #e4e6e9;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class ScreenTimeModalComponent {
  screenTimeService = inject(ScreenTimeService);

  dismissBreak(): void {
    this.screenTimeService.dismissBreakReminder();
  }

  dismissLimit(): void {
    this.screenTimeService.dismissDailyLimitWarning();
  }
}
