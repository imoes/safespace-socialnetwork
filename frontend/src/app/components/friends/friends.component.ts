import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface UserSearchResult {
  uid: number;
  username: string;
  bio?: string;
  role: string;
}

interface Friend {
  uid: number;
  username: string;
  profile_picture?: string;
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
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="friends-page">
      <!-- Left Sidebar -->
      <aside class="friends-sidebar">
        <div class="sidebar-header">
          <h2>{{ 'friendsPage.title' | translate }}</h2>
        </div>
        <nav class="sidebar-nav">
          <button
            class="sidebar-nav-item"
            [class.active]="activeTab() === 'requests'"
            (click)="loadRequests(); activeTab.set('requests')">
            <span class="sidebar-nav-icon">👤</span>
            <span class="sidebar-nav-label">{{ 'friendsPage.requests' | translate }}</span>
            @if (requests().length > 0) {
              <span class="sidebar-nav-badge">{{ requests().length }}</span>
            }
          </button>
          <button
            class="sidebar-nav-item"
            [class.active]="activeTab() === 'search'"
            (click)="activeTab.set('search')">
            <span class="sidebar-nav-icon">🔍</span>
            <span class="sidebar-nav-label">{{ 'friendsPage.searchUsers' | translate }}</span>
          </button>
          <button
            class="sidebar-nav-item"
            [class.active]="activeTab() === 'friends'"
            (click)="loadFriends(); activeTab.set('friends')">
            <span class="sidebar-nav-icon">👥</span>
            <span class="sidebar-nav-label">{{ 'friends.myFriends' | translate }}</span>
            @if (friends().length > 0) {
              <span class="sidebar-nav-count">{{ friends().length }}</span>
            }
          </button>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="friends-main">
        @if (successMessage()) {
          <div class="alert alert-success">{{ successMessage() }}</div>
        }

        @if (errorMessage()) {
          <div class="alert alert-error">{{ errorMessage() }}</div>
        }

        <!-- Friend Requests -->
        @if (activeTab() === 'requests') {
          <div class="content-section">
            <div class="section-header">
              <h3>{{ 'friendsPage.requests' | translate }}</h3>
            </div>
            @if (loadingRequests()) {
              <div class="loading">{{ 'friendsPage.loadingRequests' | translate }}</div>
            } @else if (requests().length > 0) {
              <div class="cards-grid">
                @for (request of requests(); track request.uid) {
                  <div class="person-card">
                    <div class="person-card-avatar" (click)="goToFriendProfile(request.uid)">
                      <div class="person-card-avatar-placeholder">{{ request.username.charAt(0).toUpperCase() }}</div>
                    </div>
                    <div class="person-card-info">
                      <div class="person-card-name" (click)="goToFriendProfile(request.uid)">{{ request.username }}</div>
                      <div class="person-card-meta">{{ formatDate(request.created_at) }}</div>
                      <div class="person-card-actions">
                        <button
                          class="btn btn-confirm"
                          (click)="acceptRequest(request)"
                          [disabled]="isProcessing.has(request.uid)">
                          {{ 'friendsPage.acceptBtn' | translate }}
                        </button>
                        <button
                          class="btn btn-delete"
                          (click)="declineRequest(request)"
                          [disabled]="isProcessing.has(request.uid)">
                          {{ 'friendsPage.declineBtn' | translate }}
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">
                {{ 'friendsPage.noPendingRequests' | translate }}
              </div>
            }
          </div>
        }

        <!-- Search Users -->
        @if (activeTab() === 'search') {
          <div class="content-section">
            <div class="section-header">
              <h3>{{ 'friendsPage.searchUsers' | translate }}</h3>
            </div>
            <div class="search-box">
              <input
                type="text"
                [(ngModel)]="searchQuery"
                (input)="onSearchInput()"
                [placeholder]="'friendsPage.searchPlaceholder' | translate"
                class="search-input"
              />
              @if (searching()) {
                <span class="search-spinner">🔄</span>
              }
            </div>

            @if (searchResults().length > 0) {
              <div class="cards-grid">
                @for (user of searchResults(); track user.uid) {
                  <div class="person-card">
                    <div class="person-card-avatar">
                      <div class="person-card-avatar-placeholder">{{ user.username.charAt(0).toUpperCase() }}</div>
                    </div>
                    <div class="person-card-info">
                      <div class="person-card-name">{{ user.username }}</div>
                      @if (user.bio) {
                        <div class="person-card-meta">{{ user.bio }}</div>
                      }
                      <div class="person-card-actions">
                        <button
                          class="btn btn-confirm"
                          (click)="sendFriendRequest(user)"
                          [disabled]="isSending.has(user.uid)">
                          {{ isSending.has(user.uid) ? ('friendsPage.sending' | translate) : ('friendsPage.friendRequest' | translate) }}
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else if (searchQuery.length >= 2) {
              <div class="empty-state">
                {{ 'friendsPage.noUsersFound' | translate }} "{{ searchQuery }}"
              </div>
            } @else if (searchQuery.length > 0) {
              <div class="empty-state">
                {{ 'friendsPage.minChars' | translate }}
              </div>
            }
          </div>
        }

        <!-- All Friends -->
        @if (activeTab() === 'friends') {
          <div class="content-section">
            <div class="section-header">
              <h3>{{ 'friends.myFriends' | translate }} ({{ friends().length }})</h3>
            </div>
            @if (loadingFriends()) {
              <div class="loading">{{ 'friendsPage.loadingFriends' | translate }}</div>
            } @else if (friends().length > 0) {
              <div class="cards-grid">
                @for (friend of friends(); track friend.uid) {
                  <div class="person-card">
                    <div class="person-card-avatar" (click)="goToFriendProfile(friend.uid)">
                      @if (friend.profile_picture) {
                        <img [src]="friend.profile_picture" [alt]="friend.username" class="person-card-avatar-img" />
                      } @else {
                        <div class="person-card-avatar-placeholder">{{ friend.username.charAt(0).toUpperCase() }}</div>
                      }
                    </div>
                    <div class="person-card-info">
                      <div class="person-card-name" (click)="goToFriendProfile(friend.uid)">{{ friend.username }}</div>
                      <div class="person-card-meta">
                        <span class="relationship-badge" [class]="'rel-' + friend.relationship">
                          {{ getRelationshipLabel(friend.relationship) }}
                        </span>
                      </div>
                      <div class="person-card-actions" (click)="$event.stopPropagation()">
                        <select
                          [value]="friend.relationship"
                          (change)="updateRelationship(friend, $event)"
                          class="relationship-select">
                          <option value="acquaintance">{{ 'friendsPage.acquaintance' | translate }}</option>
                          <option value="friend">{{ 'friendsPage.friend' | translate }}</option>
                          <option value="close_friend">{{ 'friendsPage.closeFriend' | translate }}</option>
                          <option value="family">{{ 'visibility.family' | translate }}</option>
                        </select>
                        <button
                          class="btn btn-delete"
                          (click)="unfriend(friend)"
                          [disabled]="isProcessing.has(friend.uid)">
                          {{ 'friendsPage.end' | translate }}
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">
                <p>{{ 'friendsPage.noFriendsDesc' | translate }}</p>
                <p>{{ 'friendsPage.noFriendsHint' | translate }}</p>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    /* === Facebook-style Friends Page Layout === */
    .friends-page {
      display: flex;
      min-height: calc(100vh - 56px);
    }

    /* Left Sidebar */
    .friends-sidebar {
      position: sticky;
      top: 56px;
      width: 360px;
      height: calc(100vh - 56px);
      background: white;
      box-shadow: 2px 0 4px rgba(0,0,0,0.05);
      overflow-y: auto;
      flex-shrink: 0;
      z-index: 10;
    }
    .sidebar-header {
      padding: 20px 16px 12px;
    }
    .sidebar-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #050505;
    }
    .sidebar-nav {
      padding: 4px 8px;
    }
    .sidebar-nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      background: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      color: #050505;
      text-align: left;
      transition: background 0.15s;
    }
    .sidebar-nav-item:hover { background: #f0f2f5; }
    .sidebar-nav-item.active { background: #e7f3ff; color: #1877f2; }
    .sidebar-nav-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: #e4e6e9;
      border-radius: 50%;
      font-size: 18px;
      flex-shrink: 0;
    }
    .sidebar-nav-item.active .sidebar-nav-icon {
      background: #1877f2;
      filter: brightness(1);
    }
    .sidebar-nav-label { flex: 1; }
    .sidebar-nav-badge {
      background: #e74c3c;
      color: white;
      border-radius: 10px;
      padding: 2px 8px;
      font-size: 13px;
      font-weight: 700;
    }
    .sidebar-nav-count {
      color: #65676b;
      font-size: 14px;
    }

    /* Main Content Area */
    .friends-main {
      flex: 1;
      padding: 24px;
      background: #f0f2f5;
      min-width: 0;
    }

    .content-section {
      max-width: 960px;
    }

    .section-header {
      margin-bottom: 20px;
    }
    .section-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #050505;
    }

    /* Person Cards Grid */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .person-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .person-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .person-card-avatar {
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
      cursor: pointer;
      background: #f0f2f5;
    }
    .person-card-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .person-card-avatar-placeholder {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 48px;
    }

    .person-card-info {
      padding: 12px;
    }
    .person-card-name {
      font-weight: 600;
      font-size: 15px;
      color: #050505;
      cursor: pointer;
      margin-bottom: 4px;
    }
    .person-card-name:hover { text-decoration: underline; }
    .person-card-meta {
      font-size: 13px;
      color: #65676b;
      margin-bottom: 10px;
    }
    .person-card-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      text-align: center;
      width: 100%;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-confirm {
      background: #1877f2;
      color: white;
    }
    .btn-confirm:hover:not(:disabled) { background: #166fe5; }

    .btn-delete {
      background: #e4e6e9;
      color: #050505;
    }
    .btn-delete:hover:not(:disabled) { background: #d8dadf; }

    /* Relationship */
    .relationship-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }
    .rel-family { background: #fce4ec; color: #c62828; }
    .rel-close_friend { background: #fff3e0; color: #e65100; }
    .rel-friend { background: #e3f2fd; color: #1565c0; }
    .rel-acquaintance { background: #f5f5f5; color: #616161; }

    .relationship-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      background: white;
    }

    /* Search */
    .search-box {
      position: relative;
      margin-bottom: 20px;
    }
    .search-input {
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-radius: 50px;
      font-size: 15px;
      background: white;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      outline: none;
      box-sizing: border-box;
    }
    .search-input:focus { box-shadow: 0 0 0 2px #1877f2; }
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

    /* Alerts */
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }

    .loading, .empty-state {
      text-align: center;
      padding: 40px;
      color: #65676b;
    }
    .empty-state p { margin: 8px 0; }

    @media (max-width: 900px) {
      .friends-page { flex-direction: column; }
      .friends-sidebar {
        position: static;
        width: 100%;
        height: auto;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      .sidebar-nav {
        display: flex;
        overflow-x: auto;
        gap: 4px;
        padding: 4px 8px 8px;
      }
      .sidebar-nav-item {
        flex-shrink: 0;
        padding: 8px 16px;
      }
      .sidebar-nav-icon { width: 28px; height: 28px; font-size: 14px; }
      .friends-main { padding: 12px; }
      .cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 8px;
      }
      .person-card-avatar-placeholder { font-size: 36px; }
    }
  `]
})
export class FriendsComponent implements OnInit {
  authService = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);
  private i18n = inject(I18nService);

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
        this.errorMessage.set(this.i18n.t('errors.search'));
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
        this.successMessage.set(this.i18n.t('friendsPage.requestSent').replace('{{username}}', user.username));
        this.isSending.delete(user.uid);
        // Remove from search results
        this.searchResults.set(this.searchResults().filter(u => u.uid !== user.uid));
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || this.i18n.t('errors.sendRequest'));
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
        this.errorMessage.set(this.i18n.t('errors.loadFriends'));
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
        this.errorMessage.set(this.i18n.t('errors.loadRequests'));
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
        this.successMessage.set(this.i18n.t('friendsPage.friendAccepted').replace('{{username}}', request.username));
        this.isProcessing.delete(request.uid);
        this.loadRequests();
        this.loadFriends();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || this.i18n.t('errors.acceptRequest'));
        this.isProcessing.delete(request.uid);
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  declineRequest(request: FriendRequest): void {
    this.isProcessing.add(request.uid);
    this.clearMessages();

    // TODO: Implement decline endpoint
    this.errorMessage.set(this.i18n.t('friendsPage.notImplemented'));
    this.isProcessing.delete(request.uid);
    setTimeout(() => this.errorMessage.set(''), 3000);
  }

  updateRelationship(friend: Friend, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newRelationship = select.value;

    this.http.put(`/api/friends/${friend.uid}/relationship`, { relationship: newRelationship }).subscribe({
      next: () => {
        this.successMessage.set(this.i18n.t('friendsPage.relationshipUpdated'));
        friend.relationship = newRelationship;
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || this.i18n.t('errors.updateRelationship'));
        select.value = friend.relationship;
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  unfriend(friend: Friend): void {
    this.isProcessing.add(friend.uid);
    this.clearMessages();

    this.http.delete(`/api/friends/${friend.uid}`).subscribe({
      next: () => {
        this.successMessage.set(this.i18n.t('friendsPage.friendshipEnded').replace('{{username}}', friend.username));
        this.isProcessing.delete(friend.uid);
        // Remove from list
        this.friends.set(this.friends().filter(f => f.uid !== friend.uid));
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || this.i18n.t('errors.unfriend'));
        this.isProcessing.delete(friend.uid);
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  getRoleLabel(role: string): string {
    const keyMap: Record<string, string> = {
      'admin': 'friendsPage.roleAdmin',
      'moderator': 'friendsPage.roleModerator',
      'user': 'friendsPage.roleUser'
    };
    return keyMap[role] ? this.i18n.t(keyMap[role]) : role;
  }

  getRelationshipLabel(relationship: string): string {
    const keyMap: Record<string, string> = {
      'family': 'visibility.family',
      'close_friend': 'friendsPage.closeFriend',
      'friend': 'friendsPage.friend',
      'acquaintance': 'friendsPage.acquaintance'
    };
    return keyMap[relationship] ? this.i18n.t(keyMap[relationship]) : relationship;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const lang = this.i18n.currentLanguage()?.code || 'en';
    const locale = lang === 'de' ? 'de-DE' :
                   lang === 'es' ? 'es-ES' :
                   lang === 'it' ? 'it-IT' :
                   lang === 'fr' ? 'fr-FR' :
                   lang === 'ar' ? 'ar-SA' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  goToFriendProfile(uid: number): void {
    this.router.navigate(['/profile', uid]);
  }
}
