import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

interface UserSearchResult {
  uid: number;
  username: string;
  bio?: string;
  role: string;
}

interface Friend {
  uid: number;
  username: string;
  relationship: string;
  created_at: string;
}

interface FriendRequest {
  uid: number;
  username: string;
  created_at: string;
}

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="friends-container">
      <!-- Header -->
      <div class="header">
        <h2>👫 Freunde & Vernetzung</h2>
        <p class="subtitle">Vernetzen Sie sich mit anderen Benutzern</p>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab"
          [class.active]="activeTab() === 'search'"
          (click)="activeTab.set('search')">
          🔍 Benutzer suchen
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'friends'"
          (click)="loadFriends(); activeTab.set('friends')">
          👥 Meine Freunde ({{ friends().length }})
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'requests'"
          (click)="loadRequests(); activeTab.set('requests')">
          📬 Anfragen ({{ requests().length }})
        </button>
      </div>

      @if (successMessage()) {
        <div class="alert alert-success">{{ successMessage() }}</div>
      }

      @if (errorMessage()) {
        <div class="alert alert-error">{{ errorMessage() }}</div>
      }

      <!-- Search Tab -->
      @if (activeTab() === 'search') {
        <div class="search-section">
          <div class="search-box">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (input)="onSearchInput()"
              placeholder="Benutzernamen suchen..."
              class="search-input"
            />
            @if (searching()) {
              <span class="search-spinner">🔄</span>
            }
          </div>

          @if (searchResults().length > 0) {
            <div class="results-list">
              @for (user of searchResults(); track user.uid) {
                <div class="user-card">
                  <div class="user-info">
                    <div class="user-name">{{ user.username }}</div>
                    @if (user.bio) {
                      <div class="user-bio">{{ user.bio }}</div>
                    }
                    <div class="user-role">{{ getRoleLabel(user.role) }}</div>
                  </div>
                  <button
                    class="btn btn-primary"
                    (click)="sendFriendRequest(user)"
                    [disabled]="isSending.has(user.uid)">
                    {{ isSending.has(user.uid) ? 'Sende...' : '➕ Freundschaftsanfrage' }}
                  </button>
                </div>
              }
            </div>
          } @else if (searchQuery.length >= 2) {
            <div class="empty-state">
              Keine Benutzer gefunden mit "{{ searchQuery }}"
            </div>
          } @else if (searchQuery.length > 0) {
            <div class="empty-state">
              Bitte mindestens 2 Zeichen eingeben
            </div>
          }
        </div>
      }

      <!-- Friends Tab -->
      @if (activeTab() === 'friends') {
        <div class="friends-section">
          @if (loadingFriends()) {
            <div class="loading">Lade Freunde...</div>
          } @else if (friends().length > 0) {
            <div class="friends-list">
              @for (friend of friends(); track friend.uid) {
                <div class="friend-card">
                  <div class="friend-info">
                    <div class="friend-name">{{ friend.username }}</div>
                    <div class="friend-meta">
                      <span class="relationship-badge" [class]="'rel-' + friend.relationship">
                        {{ getRelationshipLabel(friend.relationship) }}
                      </span>
                      <span class="friend-since">
                        Freunde seit {{ formatDate(friend.created_at) }}
                      </span>
                    </div>
                  </div>
                  <div class="friend-actions">
                    <select
                      [value]="friend.relationship"
                      (change)="updateRelationship(friend, $event)"
                      class="relationship-select">
                      <option value="friend">Freund</option>
                      <option value="close_friend">Enger Freund</option>
                      <option value="family">Familie</option>
                    </select>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              <p>Sie haben noch keine Freunde.</p>
              <p>Nutzen Sie die Suche, um Benutzer zu finden!</p>
            </div>
          }
        </div>
      }

      <!-- Requests Tab -->
      @if (activeTab() === 'requests') {
        <div class="requests-section">
          @if (loadingRequests()) {
            <div class="loading">Lade Anfragen...</div>
          } @else if (requests().length > 0) {
            <div class="requests-list">
              @for (request of requests(); track request.uid) {
                <div class="request-card">
                  <div class="request-info">
                    <div class="request-name">{{ request.username }}</div>
                    <div class="request-time">{{ formatDate(request.created_at) }}</div>
                  </div>
                  <div class="request-actions">
                    <button
                      class="btn btn-success"
                      (click)="acceptRequest(request)"
                      [disabled]="isProcessing.has(request.uid)">
                      ✓ Annehmen
                    </button>
                    <button
                      class="btn btn-danger"
                      (click)="declineRequest(request)"
                      [disabled]="isProcessing.has(request.uid)">
                      ✗ Ablehnen
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              Keine ausstehenden Freundschaftsanfragen
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .friends-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      margin-bottom: 24px;
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

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 2px solid #e4e6e9;
    }

    .tab {
      padding: 12px 24px;
      border: none;
      background: none;
      color: #666;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
      margin-bottom: -2px;
    }

    .tab:hover {
      color: #1877f2;
    }

    .tab.active {
      color: #1877f2;
      border-bottom-color: #1877f2;
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

    .search-section {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .search-box {
      position: relative;
      margin-bottom: 24px;
    }

    .search-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e4e6e9;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #1877f2;
    }

    .search-spinner {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: translateY(-50%) rotate(0deg); }
      to { transform: translateY(-50%) rotate(360deg); }
    }

    .results-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .user-card, .friend-card, .request-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .user-card:hover, .friend-card:hover, .request-card:hover {
      background: #f0f2f5;
    }

    .user-info, .friend-info, .request-info {
      flex: 1;
    }

    .user-name, .friend-name, .request-name {
      font-weight: 600;
      color: #333;
      font-size: 16px;
      margin-bottom: 4px;
    }

    .user-bio {
      color: #666;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .user-role {
      color: #999;
      font-size: 12px;
    }

    .friend-meta {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 6px;
    }

    .relationship-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .rel-family {
      background: #e74c3c;
      color: white;
    }

    .rel-close_friend {
      background: #f39c12;
      color: white;
    }

    .rel-friend {
      background: #3498db;
      color: white;
    }

    .friend-since, .request-time {
      color: #999;
      font-size: 12px;
    }

    .relationship-select {
      padding: 6px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
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

    .btn-success {
      background: #27ae60;
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #229954;
    }

    .btn-danger {
      background: #e74c3c;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c0392b;
    }

    .loading, .empty-state {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .empty-state p {
      margin: 8px 0;
    }

    .friends-section, .requests-section {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .friends-list, .requests-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .friend-actions, .request-actions {
      display: flex;
      gap: 8px;
    }
  `]
})
export class FriendsComponent implements OnInit {
  authService = inject(AuthService);
  http = inject(HttpClient);

  activeTab = signal<'search' | 'friends' | 'requests'>('search');

  // Search
  searchQuery = '';
  searchResults = signal<UserSearchResult[]>([]);
  searching = signal(false);
  isSending = new Set<number>();

  // Friends
  friends = signal<Friend[]>([]);
  loadingFriends = signal(false);

  // Requests
  requests = signal<FriendRequest[]>([]);
  loadingRequests = signal(false);
  isProcessing = new Set<number>();

  // Messages
  successMessage = signal('');
  errorMessage = signal('');

  private searchTimeout: any;

  ngOnInit(): void {
    this.loadFriends();
    this.loadRequests();
  }

  onSearchInput(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (this.searchQuery.length < 2) {
      this.searchResults.set([]);
      return;
    }

    this.searching.set(true);
    this.searchTimeout = setTimeout(() => {
      this.searchUsers();
    }, 500);
  }

  searchUsers(): void {
    this.http.get<UserSearchResult[]>(`/api/users/search?q=${encodeURIComponent(this.searchQuery)}`).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.searching.set(false);
      },
      error: (error) => {
        this.errorMessage.set('Fehler bei der Suche');
        this.searching.set(false);
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  sendFriendRequest(user: UserSearchResult): void {
    this.isSending.add(user.uid);
    this.clearMessages();

    this.http.post('/api/friends/request', { target_uid: user.uid, relation_type: 'friend' }).subscribe({
      next: () => {
        this.successMessage.set(`Freundschaftsanfrage an ${user.username} gesendet!`);
        this.isSending.delete(user.uid);
        // Entfernen aus Suchergebnissen
        this.searchResults.set(this.searchResults().filter(u => u.uid !== user.uid));
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Senden der Anfrage');
        this.isSending.delete(user.uid);
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  loadFriends(): void {
    this.loadingFriends.set(true);
    this.clearMessages();

    this.http.get<{friends: Friend[]}>('/api/friends').subscribe({
      next: (response) => {
        this.friends.set(response.friends);
        this.loadingFriends.set(false);
      },
      error: (error) => {
        this.errorMessage.set('Fehler beim Laden der Freunde');
        this.loadingFriends.set(false);
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  loadRequests(): void {
    this.loadingRequests.set(true);
    this.clearMessages();

    this.http.get<{requests: FriendRequest[]}>('/api/friends/requests').subscribe({
      next: (response) => {
        this.requests.set(response.requests);
        this.loadingRequests.set(false);
      },
      error: (error) => {
        this.errorMessage.set('Fehler beim Laden der Anfragen');
        this.loadingRequests.set(false);
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  acceptRequest(request: FriendRequest): void {
    this.isProcessing.add(request.uid);
    this.clearMessages();

    this.http.post(`/api/friends/accept/${request.uid}`, {}).subscribe({
      next: () => {
        this.successMessage.set(`${request.username} ist jetzt dein Freund!`);
        this.isProcessing.delete(request.uid);
        this.loadRequests();
        this.loadFriends();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Annehmen der Anfrage');
        this.isProcessing.delete(request.uid);
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  declineRequest(request: FriendRequest): void {
    this.isProcessing.add(request.uid);
    this.clearMessages();

    // TODO: Implement decline endpoint
    this.errorMessage.set('Ablehnen ist noch nicht implementiert');
    this.isProcessing.delete(request.uid);
    setTimeout(() => this.errorMessage.set(''), 3000);
  }

  updateRelationship(friend: Friend, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newRelationship = select.value;

    this.http.put(`/api/friends/${friend.uid}/relationship`, { relationship: newRelationship }).subscribe({
      next: () => {
        this.successMessage.set('Beziehung aktualisiert');
        friend.relationship = newRelationship;
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Fehler beim Aktualisieren');
        select.value = friend.relationship; // Zurücksetzen
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'admin': 'Administrator',
      'moderator': 'Moderator',
      'user': 'Benutzer'
    };
    return labels[role] || role;
  }

  getRelationshipLabel(relationship: string): string {
    const labels: Record<string, string> = {
      'family': 'Familie',
      'close_friend': 'Enger Freund',
      'friend': 'Freund'
    };
    return labels[relationship] || relationship;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }
}
