import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-container">
      <div class="settings-card">
        <h2>⚙️ Benutzereinstellungen</h2>

        @if (successMessage()) {
          <div class="alert alert-success">{{ successMessage() }}</div>
        }

        @if (errorMessage()) {
          <div class="alert alert-error">{{ errorMessage() }}</div>
        }

        <form (ngSubmit)="saveSettings()">
          <!-- Benutzername (nicht änderbar) -->
          <div class="form-group">
            <label>Benutzername</label>
            <input
              type="text"
              [value]="authService.currentUser()?.username"
              disabled
              class="form-control"
            />
            <small class="form-text">Der Benutzername kann nicht geändert werden</small>
          </div>

          <!-- E-Mail -->
          <div class="form-group">
            <label for="email">E-Mail-Adresse</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              class="form-control"
            />
          </div>

          <!-- Bio -->
          <div class="form-group">
            <label for="bio">Über mich</label>
            <textarea
              id="bio"
              [(ngModel)]="bio"
              name="bio"
              rows="4"
              class="form-control"
              placeholder="Erzähle etwas über dich..."
            ></textarea>
          </div>

          <!-- Passwort ändern -->
          <div class="section-divider">
            <h3>Passwort ändern</h3>
          </div>

          <div class="form-group">
            <label for="currentPassword">Aktuelles Passwort</label>
            <input
              id="currentPassword"
              type="password"
              [(ngModel)]="currentPassword"
              name="currentPassword"
              class="form-control"
              placeholder="Nur ausfüllen wenn Passwort geändert werden soll"
            />
          </div>

          <div class="form-group">
            <label for="newPassword">Neues Passwort</label>
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
            <label for="confirmPassword">Passwort bestätigen</label>
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
              {{ isSaving() ? 'Speichern...' : 'Änderungen speichern' }}
            </button>
            <button type="button" class="btn btn-secondary" (click)="goBack()">
              Abbrechen
            </button>
          </div>
        </form>
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
  `]
})
export class SettingsComponent implements OnInit {
  authService = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);

  email = '';
  bio = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  isSaving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.email = user.email;
      this.bio = user.bio || '';
    }
  }

  saveSettings(): void {
    this.successMessage.set('');
    this.errorMessage.set('');

    // Validierung
    if (!this.email) {
      this.errorMessage.set('E-Mail-Adresse ist erforderlich');
      return;
    }

    if (this.currentPassword) {
      if (!this.newPassword) {
        this.errorMessage.set('Bitte geben Sie ein neues Passwort ein');
        return;
      }
      if (this.newPassword !== this.confirmPassword) {
        this.errorMessage.set('Die Passwörter stimmen nicht überein');
        return;
      }
      if (this.newPassword.length < 6) {
        this.errorMessage.set('Das Passwort muss mindestens 6 Zeichen lang sein');
        return;
      }
    }

    this.isSaving.set(true);

    const updateData: any = {
      email: this.email,
      bio: this.bio
    };

    if (this.currentPassword && this.newPassword) {
      updateData.current_password = this.currentPassword;
      updateData.new_password = this.newPassword;
    }

    this.http.put('/api/users/me', updateData).subscribe({
      next: () => {
        this.successMessage.set('Einstellungen erfolgreich gespeichert!');
        this.isSaving.set(false);

        // Passwortfelder leeren
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';

        // User neu laden
        this.authService.loadCurrentUser();
      },
      error: (error) => {
        this.isSaving.set(false);
        if (error.status === 401) {
          this.errorMessage.set('Aktuelles Passwort ist falsch');
        } else {
          this.errorMessage.set(error.error?.detail || 'Fehler beim Speichern der Einstellungen');
        }
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
