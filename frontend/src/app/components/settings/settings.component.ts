import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { ScreenTimeService, ScreenTimeSettings } from '../../services/screen-time.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="settings-container">
      <div class="settings-card">
        <h2>⚙️ {{ 'settings.title' | translate }}</h2>

        @if (successMessage()) {
          <div class="alert alert-success">{{ successMessage() }}</div>
        }

        @if (errorMessage()) {
          <div class="alert alert-error">{{ errorMessage() }}</div>
        }

        <!-- Profilbild -->
        <div class="profile-picture-section">
          <div class="profile-picture-preview">
            @if (authService.currentUser()?.profile_picture) {
              <img [src]="authService.currentUser()?.profile_picture" alt="Profilbild" />
            } @else {
              <div class="profile-picture-placeholder">
                {{ (authService.currentUser()?.username || 'U').charAt(0).toUpperCase() }}
              </div>
            }
          </div>
          <div class="profile-picture-actions">
            <label class="btn btn-upload" for="profilePictureInput">
              📷 {{ 'settings.uploadPicture' | translate }}
            </label>
            <input
              type="file"
              id="profilePictureInput"
              accept="image/*"
              (change)="onProfilePictureSelected($event)"
              style="display: none;"
            />
            @if (uploadingProfilePicture()) {
              <div class="upload-progress">{{ 'settings.uploading' | translate }}</div>
            }
          </div>
        </div>

        <div class="section-divider"></div>

        <form (ngSubmit)="saveSettings()">
          <!-- Benutzername (nicht änderbar) -->
          <div class="form-group">
            <label>{{ 'settings.username' | translate }}</label>
            <input
              type="text"
              [value]="authService.currentUser()?.username"
              disabled
              class="form-control"
            />
            <small class="form-text">{{ 'settings.usernameCannotChange' | translate }}</small>
          </div>

          <!-- Vorname -->
          <div class="form-group">
            <label for="firstName">{{ 'settings.firstName' | translate }}</label>
            <input
              id="firstName"
              type="text"
              [(ngModel)]="firstName"
              name="firstName"
              class="form-control"
              [placeholder]="'settings.firstNamePlaceholder' | translate"
            />
          </div>

          <!-- Nachname -->
          <div class="form-group">
            <label for="lastName">{{ 'settings.lastName' | translate }}</label>
            <input
              id="lastName"
              type="text"
              [(ngModel)]="lastName"
              name="lastName"
              class="form-control"
              [placeholder]="'settings.lastNamePlaceholder' | translate"
            />
          </div>

          <!-- E-Mail -->
          <div class="form-group">
            <label for="email">{{ 'settings.email' | translate }}</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              class="form-control"
            />
          </div>

          <!-- Geburtstag -->
          <div class="form-group">
            <label for="birthday">🎂 {{ 'settings.birthday' | translate }}</label>
            <input
              id="birthday"
              type="date"
              [(ngModel)]="birthday"
              name="birthday"
              class="form-control"
            />
          </div>

          <!-- Bio -->
          <div class="form-group">
            <label for="bio">{{ 'settings.bio' | translate }}</label>
            <textarea
              id="bio"
              [(ngModel)]="bio"
              name="bio"
              rows="4"
              class="form-control"
              [placeholder]="'settings.bioPlaceholder' | translate"
            ></textarea>
          </div>

          <!-- Sprache / Language -->
          <div class="form-group">
            <label for="language">🌐 {{ 'settings.language' | translate }}</label>
            <select
              id="language"
              [(ngModel)]="selectedLanguage"
              name="language"
              class="form-control"
              (change)="onLanguageChange()">
              @for (lang of i18n.languages(); track lang.code) {
                <option [value]="lang.code">
                  {{ lang.flag }} {{ lang.nativeName }}
                </option>
              }
            </select>
            <small class="form-text">{{ 'settings.languageHelp' | translate }}</small>
          </div>

          <!-- E-Mail-Benachrichtigungen -->
          <div class="section-divider">
            <h3>📧 {{ 'settings.emailNotifications' | translate }}</h3>
          </div>

          <div class="notification-prefs">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="notifPrefs.post_liked" name="notif_post_liked" />
              <span>{{ 'settings.notifPostLiked' | translate }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="notifPrefs.post_commented" name="notif_post_commented" />
              <span>{{ 'settings.notifPostCommented' | translate }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="notifPrefs.comment_liked" name="notif_comment_liked" />
              <span>{{ 'settings.notifCommentLiked' | translate }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="notifPrefs.birthday" name="notif_birthday" />
              <span>{{ 'settings.notifBirthday' | translate }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="notifPrefs.group_post" name="notif_group_post" />
              <span>{{ 'settings.notifGroupPost' | translate }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="notifPrefs.friend_request" name="notif_friend_request" />
              <span>{{ 'settings.notifFriendRequest' | translate }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="notifPrefs.friend_request_accepted" name="notif_friend_request_accepted" />
              <span>{{ 'settings.notifFriendRequestAccepted' | translate }}</span>
            </label>
          </div>

          <!-- Screen Time / Mental Health -->
          <div class="section-divider">
            <h3>{{ 'settings.screenTimeTitle' | translate }}</h3>
          </div>

          <div class="screen-time-section">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="screenTimeEnabled" name="screen_time_enabled" />
              <span>{{ 'settings.screenTimeEnabled' | translate }}</span>
            </label>

            @if (screenTimeEnabled) {
              <div class="form-group" style="margin-top: 16px;">
                <label for="dailyLimit">{{ 'settings.screenTimeDailyLimit' | translate }}</label>
                <div class="range-group">
                  <input
                    id="dailyLimit"
                    type="range"
                    [(ngModel)]="screenTimeDailyLimit"
                    name="daily_limit"
                    min="15"
                    max="480"
                    step="15"
                    class="form-range"
                  />
                  <span class="range-value">{{ screenTimeDailyLimit }} {{ 'settings.screenTimeMinutes' | translate }}</span>
                </div>
              </div>

              <label class="checkbox-label" style="margin-top: 16px;">
                <input type="checkbox" [(ngModel)]="screenTimeReminderEnabled" name="screen_time_reminder_enabled" />
                <span>{{ 'settings.screenTimeReminderEnabled' | translate }}</span>
              </label>

              @if (screenTimeReminderEnabled) {
                <div class="form-group" style="margin-top: 16px;">
                  <label for="reminderInterval">{{ 'settings.screenTimeReminderInterval' | translate }}</label>
                  <div class="range-group">
                    <input
                      id="reminderInterval"
                      type="range"
                      [(ngModel)]="screenTimeReminderInterval"
                      name="reminder_interval"
                      min="10"
                      max="120"
                      step="5"
                      class="form-range"
                    />
                    <span class="range-value">{{ screenTimeReminderInterval }} {{ 'settings.screenTimeMinutes' | translate }}</span>
                  </div>
                </div>
              }

              <div class="screen-time-info">
                <span class="info-icon">&#9432;</span>
                {{ 'settings.screenTimeInfo' | translate }}
              </div>
            }
          </div>

          <!-- Passwort ändern -->
          <div class="section-divider">
            <h3>{{ 'settings.passwordSection' | translate }}</h3>
          </div>

          <div class="form-group">
            <label for="currentPassword">{{ 'settings.currentPassword' | translate }}</label>
            <input
              id="currentPassword"
              type="password"
              [(ngModel)]="currentPassword"
              name="currentPassword"
              class="form-control"
              [placeholder]="'settings.currentPasswordPlaceholder' | translate"
            />
          </div>

          <div class="form-group">
            <label for="newPassword">{{ 'settings.newPassword' | translate }}</label>
            <input
              id="newPassword"
              type="password"
              [(ngModel)]="newPassword"
              name="newPassword"
              class="form-control"
              [disabled]="!currentPassword"
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">{{ 'settings.confirmPassword' | translate }}</label>
            <input
              id="confirmPassword"
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              class="form-control"
              [disabled]="!currentPassword"
            />
          </div>

          <!-- Buttons -->
          <div class="button-group">
            <button type="submit" class="btn btn-primary" [disabled]="isSaving()">
              {{ (isSaving() ? 'settings.saving' : 'settings.save') | translate }}
            </button>
            <button type="button" class="btn btn-secondary" (click)="goBack()">
              {{ 'settings.cancel' | translate }}
            </button>
          </div>
        </form>

        <!-- DSGVO: Datenexport -->
        <div class="data-export-section">
          <div class="section-divider">
            <h3>{{ 'settings.dataExportTitle' | translate }}</h3>
          </div>
          <p class="export-desc">{{ 'settings.dataExportDesc' | translate }}</p>
          <button type="button" class="btn btn-export" (click)="exportData()" [disabled]="isExporting()">
            {{ (isExporting() ? 'settings.dataExporting' : 'settings.dataExportButton') | translate }}
          </button>
        </div>

        <!-- Gefahrenzone: Konto löschen -->
        <div class="danger-zone">
          <div class="section-divider">
            <h3>⚠️ {{ 'settings.dangerZone' | translate }}</h3>
          </div>
          <div class="danger-box">
            <h4>{{ 'settings.deleteAccount' | translate }}</h4>
            <p>{{ 'settings.deleteAccountDesc' | translate }}</p>
            <ul>
              @for (item of i18n.tArray('settings.deleteAccountList'); track $index) {
                <li>{{ item }}</li>
              }
            </ul>
            <p class="danger-warning"><strong>{{ 'settings.deleteAccountWarning' | translate }}</strong></p>
            <button type="button" class="btn btn-danger" (click)="deleteAccount()">
              🗑️ {{ 'settings.deleteAccountButton' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
    }

    .settings-card {
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    h2 {
      margin: 0 0 24px 0;
      color: #333;
      font-size: 24px;
    }

    h3 {
      margin: 0;
      color: #666;
      font-size: 18px;
    }

    .alert {
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
    }

    .alert-success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .alert-error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .profile-picture-section {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 32px;
    }

    .profile-picture-preview {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .profile-picture-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-picture-placeholder {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
    }

    .profile-picture-actions {
      flex: 1;
    }

    .btn-upload {
      display: inline-block;
      padding: 10px 24px;
      background: #1877f2;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-upload:hover {
      background: #155db2;
    }

    .upload-progress {
      margin-top: 8px;
      color: #1877f2;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 6px;
      color: #333;
      font-weight: 500;
    }

    .form-control {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: #1877f2;
    }

    .form-control:disabled {
      background: #f5f5f5;
      color: #999;
      cursor: not-allowed;
    }

    .form-text {
      display: block;
      margin-top: 4px;
      color: #666;
      font-size: 12px;
    }

    textarea.form-control {
      resize: vertical;
      min-height: 80px;
    }

    .section-divider {
      margin: 32px 0 20px 0;
      padding-top: 24px;
      border-top: 1px solid #e4e6e9;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 32px;
    }

    .btn {
      padding: 10px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #1877f2;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #155db2;
    }

    .btn-secondary {
      background: #f0f2f5;
      color: #666;
    }

    .btn-secondary:hover {
      background: #e4e6e9;
    }

    /* Datenexport */
    .data-export-section {
      margin-top: 48px;
    }

    .export-desc {
      color: #65676b;
      font-size: 14px;
      margin: 8px 0 16px 0;
      line-height: 1.5;
    }

    .btn-export {
      padding: 10px 24px;
      background: #2e7d32;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-export:hover:not(:disabled) {
      background: #1b5e20;
    }

    .btn-export:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Gefahrenzone */
    .danger-zone {
      margin-top: 48px;
    }

    .danger-box {
      background: #fff5f5;
      border: 2px solid #feb2b2;
      border-radius: 8px;
      padding: 24px;
    }

    .danger-box h4 {
      margin: 0 0 12px 0;
      color: #c53030;
      font-size: 18px;
    }

    .danger-box p {
      color: #742a2a;
      margin-bottom: 12px;
    }

    .danger-box ul {
      color: #742a2a;
      margin: 12px 0;
      padding-left: 24px;
    }

    .danger-box li {
      margin-bottom: 6px;
    }

    .danger-warning {
      font-weight: 700;
      color: #c53030;
      margin-top: 16px;
      margin-bottom: 16px;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c82333;
    }

    .notification-prefs {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 8px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 10px 12px;
      background: #f9f9f9;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .checkbox-label:hover {
      background: #f0f0f0;
    }

    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #1877f2;
      cursor: pointer;
    }

    .checkbox-label span {
      font-size: 14px;
      color: #333;
    }

    /* Screen Time */
    .screen-time-section {
      margin-bottom: 8px;
    }

    .range-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .form-range {
      flex: 1;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: #e4e6e9;
      border-radius: 3px;
      outline: none;
    }

    .form-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #1877f2;
      cursor: pointer;
    }

    .form-range::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #1877f2;
      cursor: pointer;
      border: none;
    }

    .range-value {
      min-width: 80px;
      text-align: right;
      font-weight: 600;
      color: #1877f2;
      font-size: 14px;
    }

    .screen-time-info {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      background: #e8f4fd;
      border-radius: 8px;
      color: #1565c0;
      font-size: 13px;
      line-height: 1.5;
      margin-top: 16px;
    }

    .info-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    @media (max-width: 1024px) {
      .settings-container { margin: 16px auto; padding: 12px; }
      .settings-card { padding: 20px 16px; }
      h2 { font-size: 20px; }
      .profile-picture-section { flex-direction: column; text-align: center; gap: 16px; }
      .button-group { flex-direction: column; }
      .btn { width: 100%; text-align: center; }
    }
  `]
})
export class SettingsComponent implements OnInit {
  authService = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);
  i18n = inject(I18nService);
  screenTimeService = inject(ScreenTimeService);

  email = '';
  bio = '';
  firstName = '';
  lastName = '';
  birthday = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  selectedLanguage = 'en';
  originalLanguage = 'en';

  notifPrefs = {
    post_liked: true,
    post_commented: true,
    comment_liked: true,
    birthday: true,
    group_post: true,
    friend_request: true,
    friend_request_accepted: true
  };

  screenTimeEnabled = true;
  screenTimeDailyLimit = 120;
  screenTimeReminderEnabled = true;
  screenTimeReminderInterval = 30;

  isSaving = signal(false);
  isExporting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  uploadingProfilePicture = signal(false);

  constructor() {
    // Watch for user changes and update form when user loads
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.email = user.email;
        this.bio = user.bio || '';
        this.firstName = user.first_name || '';
        this.lastName = user.last_name || '';
        this.birthday = user.birthday || '';
      }
    });
  }

  ngOnInit(): void {
    // Load current language and store original
    const currentLang = this.i18n.currentLanguage();
    if (currentLang) {
      this.selectedLanguage = currentLang.code;
      this.originalLanguage = this.selectedLanguage;
    } else {
      const savedLang = localStorage.getItem('preferredLanguage') || 'en';
      this.selectedLanguage = savedLang;
      this.originalLanguage = savedLang;
    }

    this.loadNotificationPreferences();
    this.loadScreenTimeSettings();
  }

  loadNotificationPreferences(): void {
    this.http.get<any>('/api/users/me/notification-preferences').subscribe({
      next: (prefs) => {
        this.notifPrefs = {
          post_liked: prefs.post_liked ?? true,
          post_commented: prefs.post_commented ?? true,
          comment_liked: prefs.comment_liked ?? true,
          birthday: prefs.birthday ?? true,
          group_post: prefs.group_post ?? true,
          friend_request: prefs.friend_request ?? true,
          friend_request_accepted: prefs.friend_request_accepted ?? true
        };
      },
      error: () => {}
    });
  }

  loadScreenTimeSettings(): void {
    this.http.get<{ settings: any }>('/api/users/me/screen-time-settings').subscribe({
      next: (response) => {
        const s = response.settings;
        this.screenTimeEnabled = s.enabled ?? true;
        this.screenTimeDailyLimit = s.daily_limit_minutes ?? 120;
        this.screenTimeReminderEnabled = s.reminder_enabled ?? true;
        this.screenTimeReminderInterval = s.reminder_interval_minutes ?? 30;
      },
      error: () => {}
    });
  }

  onLanguageChange(): void {
    // Just update the selection, don't apply yet
    // Language will be applied when user clicks "Save Settings"
  }

  saveSettings(): void {
    this.successMessage.set('');
    this.errorMessage.set('');

    // Validierung
    if (!this.email) {
      this.errorMessage.set(this.i18n.t('errors.emailRequired'));
      return;
    }

    if (this.currentPassword) {
      if (!this.newPassword) {
        this.errorMessage.set(this.i18n.t('errors.enterNewPassword'));
        return;
      }
      if (this.newPassword !== this.confirmPassword) {
        this.errorMessage.set(this.i18n.t('errors.passwordMismatch'));
        return;
      }
      if (this.newPassword.length < 6) {
        this.errorMessage.set(this.i18n.t('errors.passwordMinLength'));
        return;
      }
    }

    this.isSaving.set(true);

    const updateData: any = {
      email: this.email,
      bio: this.bio,
      first_name: this.firstName,
      last_name: this.lastName,
      preferred_language: this.selectedLanguage,
      birthday: this.birthday || null
    };

    if (this.currentPassword && this.newPassword) {
      updateData.current_password = this.currentPassword;
      updateData.new_password = this.newPassword;
    }

    // Save notification preferences in parallel
    this.http.put('/api/users/me/notification-preferences', this.notifPrefs).subscribe();

    // Save screen time settings in parallel
    const screenTimeSettings: ScreenTimeSettings = {
      enabled: this.screenTimeEnabled,
      daily_limit_minutes: this.screenTimeDailyLimit,
      reminder_enabled: this.screenTimeReminderEnabled,
      reminder_interval_minutes: this.screenTimeReminderInterval
    };
    this.screenTimeService.saveSettings(screenTimeSettings);

    this.http.put('/api/users/me', updateData).subscribe({
      next: () => {
        if (this.selectedLanguage !== this.originalLanguage) {
          this.i18n.setLanguage(this.selectedLanguage).then(() => {
            this.originalLanguage = this.selectedLanguage;
            this.successMessage.set(this.i18n.t('settings.success'));
            this.isSaving.set(false);
            this.authService.loadCurrentUser();
          }).catch(() => {
            this.errorMessage.set('Failed to change language');
            this.isSaving.set(false);
          });
        } else {
          this.successMessage.set(this.i18n.t('settings.success'));
          this.isSaving.set(false);

          // Clear password fields
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';

          // Reload user data to reflect updates
          this.authService.loadCurrentUser();
        }
      },
      error: (error) => {
        this.isSaving.set(false);
        if (error.status === 401) {
          this.errorMessage.set(this.i18n.t('errors.wrongPassword'));
        } else {
          this.errorMessage.set(error.error?.detail || this.i18n.t('errors.saveSettings'));
        }
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  exportData(): void {
    this.isExporting.set(true);
    this.http.get('/api/users/me/data-export').subscribe({
      next: (data) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `safespace-data-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
      },
      error: () => {
        this.isExporting.set(false);
        this.errorMessage.set(this.i18n.t('errors.dataExport'));
      }
    });
  }

  deleteAccount(): void {
    if (!confirm(this.i18n.t('settings.deleteConfirm1'))) {
      return;
    }

    if (!confirm(this.i18n.t('settings.deleteConfirm2'))) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    this.http.delete('/api/users/me/account').subscribe({
      next: () => {
        alert(this.i18n.t('settings.deleteSuccess'));
        this.authService.logout();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(error.error?.detail || this.i18n.t('errors.deleteAccount'));
      }
    });
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set(this.i18n.t('errors.imageTooLarge'));
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set(this.i18n.t('errors.onlyImages'));
      return;
    }

    this.uploadingProfilePicture.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formData = new FormData();
    formData.append('file', file);

    this.http.post('/api/users/me/profile-picture', formData).subscribe({
      next: (response: any) => {
        this.uploadingProfilePicture.set(false);
        this.successMessage.set(this.i18n.t('settings.success'));

        // Reload current user to update profile picture
        this.authService.loadCurrentUser();

        // Reset file input
        input.value = '';
      },
      error: (error) => {
        this.uploadingProfilePicture.set(false);
        this.errorMessage.set(error.error?.detail || this.i18n.t('errors.uploadPicture'));
        input.value = '';
      }
    });
  }
}
