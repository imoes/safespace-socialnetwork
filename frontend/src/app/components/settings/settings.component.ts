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
              📷 Profilbild hochladen
            </label>
            <input
              type="file"
              id="profilePictureInput"
              accept="image/*"
              (change)="onProfilePictureSelected($event)"
              style="display: none;"
            />
            @if (uploadingProfilePicture()) {
              <div class="upload-progress">Wird hochgeladen...</div>
            }
          </div>
        </div>

        <div class="section-divider"></div>

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

          <!-- Vorname -->
          <div class="form-group">
            <label for="firstName">Vorname</label>
            <input
              id="firstName"
              type="text"
              [(ngModel)]="firstName"
              name="firstName"
              class="form-control"
              placeholder="Dein Vorname"
            />
          </div>

          <!-- Nachname -->
          <div class="form-group">
            <label for="lastName">Nachname</label>
            <input
              id="lastName"
              type="text"
              [(ngModel)]="lastName"
              name="lastName"
              class="form-control"
              placeholder="Dein Nachname"
            />
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

        <!-- Gefahrenzone: Konto löschen -->
        <div class="danger-zone">
          <div class="section-divider">
            <h3>⚠️ Gefahrenzone</h3>
          </div>
          <div class="danger-box">
            <h4>Konto löschen</h4>
            <p>Wenn du dein Konto löschst, werden alle deine Daten permanent gelöscht:</p>
            <ul>
              <li>Alle deine Posts und Kommentare</li>
              <li>Alle hochgeladenen Medien (Bilder, Videos)</li>
              <li>Alle Freundschaften und Anfragen</li>
              <li>Dein Benutzerprofil und alle persönlichen Daten</li>
            </ul>
            <p class="danger-warning"><strong>Diese Aktion kann nicht rückgängig gemacht werden!</strong></p>
            <button type="button" class="btn btn-danger" (click)="deleteAccount()">
              🗑️ Konto permanent löschen
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
  `]
})
export class SettingsComponent implements OnInit {
  authService = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);

  email = '';
  bio = '';
  firstName = '';
  lastName = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  isSaving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  uploadingProfilePicture = signal(false);

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.email = user.email;
      this.bio = user.bio || '';
      this.firstName = user.first_name || '';
      this.lastName = user.last_name || '';
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
      bio: this.bio,
      first_name: this.firstName,
      last_name: this.lastName
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

        // User-Daten neu laden, um aktualisierte Werte anzuzeigen
        this.authService.loadCurrentUser();

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

  deleteAccount(): void {
    const confirmText = 'Bist du dir absolut sicher? Diese Aktion kann NICHT rückgängig gemacht werden!';
    if (!confirm(confirmText)) {
      return;
    }

    const doubleConfirm = 'Letzte Warnung: ALLE deine Daten werden permanent gelöscht. Möchtest du wirklich fortfahren?';
    if (!confirm(doubleConfirm)) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    this.http.delete('/api/users/me/account').subscribe({
      next: () => {
        alert('Dein Konto wurde erfolgreich gelöscht. Du wirst jetzt abgemeldet.');
        // Logout und zur Login-Seite
        this.authService.logout();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(error.error?.detail || 'Fehler beim Löschen des Kontos');
      }
    });
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set('Das Bild ist zu groß. Maximal 10MB erlaubt.');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Nur Bilddateien sind erlaubt.');
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
        this.successMessage.set('Profilbild erfolgreich hochgeladen!');

        // Reload current user to update profile picture
        this.authService.loadCurrentUser();

        // Reset file input
        input.value = '';
      },
      error: (error) => {
        this.uploadingProfilePicture.set(false);
        this.errorMessage.set(error.error?.detail || 'Fehler beim Hochladen des Profilbilds');
        input.value = '';
      }
    });
  }
}
