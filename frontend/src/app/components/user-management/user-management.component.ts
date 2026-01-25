import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface UserWithStats {
  uid: number;
  username: string;
  role: 'user' | 'moderator' | 'admin';
  created_at: string;
  post_count: number;
  report_count: number;
  is_banned: boolean;
  banned_until: string | null;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="management-container">
      <div class="header">
        <h2>👥 Benutzerverwaltung</h2>
        <p class="subtitle">Verwalten Sie alle Benutzer Ihrer Plattform</p>
      </div>

      @if (loading()) {
        <div class="loading">Lade Benutzerdaten...</div>
      }

      @if (errorMessage()) {
        <div class="alert alert-error">{{ errorMessage() }}</div>
      }

      @if (successMessage()) {
        <div class="alert alert-success">{{ successMessage() }}</div>
      }

      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-value">{{ users().length }}</div>
          <div class="stat-label">Gesamt Benutzer</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ countAdmins() }}</div>
          <div class="stat-label">Admins</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ countModerators() }}</div>
          <div class="stat-label">Moderatoren</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ countBanned() }}</div>
          <div class="stat-label">Gebannt</div>
        </div>
      </div>

      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>Benutzer</th>
              <th>Rolle</th>
              <th>Registriert</th>
              <th>Posts</th>
              <th>Reports</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.uid) {
              <tr [class.banned]="user.is_banned">
                <td>
                  <div class="user-info">
                    <span class="username">{{ user.username }}</span>
                    <span class="uid">#{{ user.uid }}</span>
                  </div>
                </td>
                <td>
                  <span class="role-badge" [class]="'role-' + user.role">
                    {{ getRoleLabel(user.role) }}
                  </span>
                </td>
                <td>{{ formatDate(user.created_at) }}</td>
                <td>{{ user.post_count }}</td>
                <td>{{ user.report_count }}</td>
                <td>
                  @if (user.is_banned) {
                    <span class="status-badge status-banned">Gebannt</span>
                  } @else {
                    <span class="status-badge status-active">Aktiv</span>
                  }
                </td>
                <td>
                  <div class="action-buttons">
                    @if (!user.is_banned) {
                      <button
                        class="btn btn-sm btn-danger"
                        (click)="banUser(user)"
                        [disabled]="user.role === 'admin' && !canBanAdmin(user)">
                        🚫 Bannen
                      </button>
                    } @else {
                      <button
                        class="btn btn-sm btn-success"
                        (click)="unbanUser(user)">
                        ✓ Entbannen
                      </button>
                    }

                    @if (user.role === 'user') {
                      <button
                        class="btn btn-sm btn-primary"
                        (click)="promoteToModerator(user)">
                        ⬆ Moderator
                      </button>
                    }

                    @if (user.role === 'moderator') {
                      <button
                        class="btn btn-sm btn-primary"
                        (click)="promoteToAdmin(user)">
                        ⬆ Admin
                      </button>
                      <button
                        class="btn btn-sm btn-secondary"
                        (click)="demoteToUser(user)">
                        ⬇ User
                      </button>
                    }

                    @if (user.role === 'admin' && canDemoteAdmin(user)) {
                      <button
                        class="btn btn-sm btn-secondary"
                        (click)="demoteToModerator(user)">
                        ⬇ Moderator
                      </button>
                    }

                    <button
                      class="btn btn-sm btn-delete"
                      (click)="deleteUser(user)"
                      [disabled]="user.role === 'admin' && !canBanAdmin(user)"
                      title="User und alle Daten permanent löschen">
                      🗑️ Löschen
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .management-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      margin-bottom: 32px;
    }

    h2 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 28px;
    }

    .subtitle {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
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

    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }

    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #1877f2;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
    }

    .users-table {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: #f8f9fa;
    }

    th {
      padding: 16px;
      text-align: left;
      font-weight: 600;
      color: #333;
      font-size: 14px;
      border-bottom: 2px solid #e4e6e9;
    }

    td {
      padding: 16px;
      border-bottom: 1px solid #e4e6e9;
      font-size: 14px;
    }

    tr.banned {
      background: #fff3f3;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .username {
      font-weight: 500;
      color: #333;
    }

    .uid {
      font-size: 12px;
      color: #999;
    }

    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .role-admin {
      background: #e74c3c;
      color: white;
    }

    .role-moderator {
      background: #f39c12;
      color: white;
    }

    .role-user {
      background: #95a5a6;
      color: white;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-active {
      background: #d4edda;
      color: #155724;
    }

    .status-banned {
      background: #f8d7da;
      color: #721c24;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-sm {
      padding: 4px 8px;
      font-size: 11px;
    }

    .btn-primary {
      background: #1877f2;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #155db2;
    }

    .btn-secondary {
      background: #95a5a6;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #7f8c8d;
    }

    .btn-danger {
      background: #e74c3c;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c0392b;
    }

    .btn-success {
      background: #27ae60;
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #229954;
    }

    .btn-delete {
      background: #8b0000;
      color: white;
    }

    .btn-delete:hover:not(:disabled) {
      background: #660000;
    }
  `]
})
export class UserManagementComponent implements OnInit {
  authService = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);

  users = signal<UserWithStats[]>([]);
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  ngOnInit(): void {
    // Nur Admins dürfen diese Seite sehen
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/']);
      return;
    }

    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.http.get<UserWithStats[]>('/api/users/list').subscribe({
      next: (data) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set('Fehler beim Laden der Benutzer');
        this.loading.set(false);
        console.error(error);
      }
    });
  }

  countAdmins(): number {
    return this.users().filter(u => u.role === 'admin').length;
  }

  countModerators(): number {
    return this.users().filter(u => u.role === 'moderator').length;
  }

  countBanned(): number {
    return this.users().filter(u => u.is_banned).length;
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'admin': 'Administrator',
      'moderator': 'Moderator',
      'user': 'Benutzer'
    };
    return labels[role] || role;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  canBanAdmin(user: UserWithStats): boolean {
    // Man kann sich selbst nicht bannen
    const currentUser = this.authService.currentUser();
    return user.uid !== currentUser?.uid;
  }

  canDemoteAdmin(user: UserWithStats): boolean {
    // Man kann sich selbst nicht degradieren
    const currentUser = this.authService.currentUser();
    return user.uid !== currentUser?.uid;
  }

  banUser(user: UserWithStats): void {
    const reason = prompt('Grund für den Bann:');
    if (!reason) return;

    const days = prompt('Dauer in Tagen (leer lassen für permanent):');
    const duration = days ? parseInt(days) : undefined;

    this.http.post(`/api/users/${user.uid}/ban`, { reason, days: duration }).subscribe({
      next: () => {
        this.successMessage.set(`${user.username} wurde erfolgreich gebannt`);
        this.loadUsers();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Bannen des Benutzers');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  unbanUser(user: UserWithStats): void {
    if (!confirm(`Möchten Sie ${user.username} wirklich entbannen?`)) return;

    this.http.post(`/api/users/${user.uid}/unban`, {}).subscribe({
      next: () => {
        this.successMessage.set(`${user.username} wurde erfolgreich entbannt`);
        this.loadUsers();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Entbannen des Benutzers');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  promoteToModerator(user: UserWithStats): void {
    if (!confirm(`Möchten Sie ${user.username} zum Moderator befördern?`)) return;

    this.http.post(`/api/admin/users/${user.uid}/role`, { role: 'moderator' }).subscribe({
      next: () => {
        this.successMessage.set(`${user.username} ist jetzt Moderator`);
        this.loadUsers();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Befördern');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  promoteToAdmin(user: UserWithStats): void {
    if (!confirm(`Möchten Sie ${user.username} zum Administrator befördern? Dies gibt volle Systemrechte!`)) return;

    this.http.post(`/api/admin/users/${user.uid}/role`, { role: 'admin' }).subscribe({
      next: () => {
        this.successMessage.set(`${user.username} ist jetzt Administrator`);
        this.loadUsers();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Befördern');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  demoteToUser(user: UserWithStats): void {
    if (!confirm(`Möchten Sie ${user.username} zum normalen Benutzer zurückstufen?`)) return;

    this.http.post(`/api/admin/users/${user.uid}/role`, { role: 'user' }).subscribe({
      next: () => {
        this.successMessage.set(`${user.username} ist jetzt normaler Benutzer`);
        this.loadUsers();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Zurückstufen');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  demoteToModerator(user: UserWithStats): void {
    if (!confirm(`Möchten Sie ${user.username} zum Moderator zurückstufen?`)) return;

    this.http.post(`/api/admin/users/${user.uid}/role`, { role: 'moderator' }).subscribe({
      next: () => {
        this.successMessage.set(`${user.username} ist jetzt Moderator`);
        this.loadUsers();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Zurückstufen');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  deleteUser(user: UserWithStats): void {
    const confirmMessage = `⚠️ WARNUNG: Diese Aktion kann nicht rückgängig gemacht werden!\n\n` +
      `Sie sind dabei, ${user.username} und ALLE zugehörigen Daten permanent zu löschen:\n` +
      `- Alle Posts und Medien\n` +
      `- Alle Freundschaften\n` +
      `- Alle Reports und Meldungen\n` +
      `- Das gesamte Benutzerkonto\n\n` +
      `Möchten Sie ${user.username} wirklich PERMANENT löschen?`;

    if (!confirm(confirmMessage)) return;

    // Zweite Bestätigung für extra Sicherheit
    if (!confirm(`Letzte Bestätigung: ${user.username} wirklich löschen?`)) return;

    this.http.delete(`/api/users/${user.uid}`).subscribe({
      next: () => {
        this.successMessage.set(`${user.username} wurde permanent gelöscht`);
        this.loadUsers();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Löschen des Benutzers');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }
}
