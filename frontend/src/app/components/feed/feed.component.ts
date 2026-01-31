import { Component, OnInit, OnDestroy, inject, effect, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FeedService, Post } from '../../services/feed.service';
import { AuthService } from '../../services/auth.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { CreatePostComponent } from '../create-post/create-post.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { HttpClient } from '@angular/common/http';

interface FriendInfo {
  uid: number;
  username: string;
  profile_picture?: string;
  relationship: string;
  created_at: string;
}

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PostCardComponent, CreatePostComponent, TranslatePipe],
  template: `
    <!-- Scroll to top button (under navbar) -->
    @if (showScrollTop) {
      <button class="scroll-top-btn" (click)="refresh()">
        ↑ {{ 'feed.scrollToTop' | translate }}
      </button>
    }

    <div class="feed-layout">
      <!-- Left Sidebar -->
      <aside class="sidebar-left desktop-only">
        <a [routerLink]="['/profile', authService.currentUser()?.uid]" class="sidebar-item sidebar-profile">
          @if (authService.currentUser()?.profile_picture) {
            <img [src]="authService.currentUser()?.profile_picture" class="sidebar-avatar-img" />
          } @else {
            <div class="sidebar-avatar">{{ authService.currentUser()?.username?.charAt(0)?.toUpperCase() }}</div>
          }
          <span>{{ authService.currentUser()?.username }}</span>
        </a>
        <a routerLink="/friends" class="sidebar-item">
          <span class="sidebar-icon">👫</span>
          <span>{{ 'nav.friends' | translate }}</span>
        </a>
        <a routerLink="/groups" class="sidebar-item">
          <span class="sidebar-icon">👥</span>
          <span>{{ 'nav.groups' | translate }}</span>
        </a>
        <a routerLink="/public-feed" class="sidebar-item">
          <span class="sidebar-icon">🌍</span>
          <span>{{ 'nav.public' | translate }}</span>
        </a>
        <a routerLink="/hashtags" class="sidebar-item">
          <span class="sidebar-icon">🏷️</span>
          <span>{{ 'nav.hashtags' | translate }}</span>
        </a>
        <a routerLink="/my-posts" class="sidebar-item">
          <span class="sidebar-icon">📝</span>
          <span>{{ 'nav.myPosts' | translate }}</span>
        </a>
        <a href="https://github.com/sponsors/imoes" target="_blank" rel="noopener noreferrer" class="sidebar-item">
          <span class="sidebar-icon">❤️</span>
          <span>{{ 'nav.donate' | translate }}</span>
        </a>
      </aside>

      <!-- Center Feed -->
      <main class="feed-center">
        <div class="feed-container">
          <!-- Create Post -->
          <app-create-post (postCreated)="onPostCreated($event)" />

          <!-- Loading indicator -->
          @if (feedService.isLoading()) {
            <div class="loading">
              <div class="spinner"></div>
              <p>{{ 'feed.loading' | translate }}</p>
            </div>
          }

          <!-- Error message -->
          @if (feedService.error()) {
            <div class="error">
              <p>{{ feedService.error() }}</p>
              <button (click)="refresh()">{{ 'feed.retry' | translate }}</button>
            </div>
          }

          <!-- Cache indicator -->
          @if (feedService.cachedAt()) {
            <div class="cache-info">
              Cached: {{ feedService.cachedAt() | date:'HH:mm:ss' }}
            </div>
          }

          <!-- Posts -->
          <div class="posts">
            @for (post of feedService.posts(); track post.post_id) {
              <app-post-card
                [post]="post"
                [currentUid]="authService.currentUser()?.uid"
                (like)="onLike($event)"
                (unlike)="onUnlike($event)"
                (delete)="onDelete($event)"
              />
            } @empty {
              @if (!feedService.isLoading()) {
                <div class="empty-feed">
                  <p>{{ 'feed.empty' | translate }}</p>
                  <p>{{ 'feed.emptyHint' | translate }}</p>
                </div>
              }
            }
          </div>

          <!-- Loading more indicator -->
          @if (feedService.isLoading() && feedService.posts().length > 0) {
            <div class="loading-more">
              <div class="spinner-small"></div>
              <p>{{ 'feed.loadingMore' | translate }}</p>
            </div>
          }

          <!-- Refresh button -->
          <button class="refresh-btn" (click)="refresh()" [title]="'common.refresh' | translate">
            ↻
          </button>
        </div>
      </main>

      <!-- Right Sidebar: Contacts -->
      <aside class="sidebar-right desktop-only">
        <div class="contacts-header">
          <span class="contacts-title">{{ 'nav.friends' | translate }}</span>
        </div>
        <div class="contacts-list">
          @for (friend of friendsList(); track friend.uid) {
            <a [routerLink]="['/profile', friend.uid]" class="contact-item">
              @if (friend.profile_picture) {
                <img [src]="friend.profile_picture" class="contact-avatar-img" />
              } @else {
                <div class="contact-avatar">{{ friend.username.charAt(0).toUpperCase() }}</div>
              }
              <span class="contact-name">{{ friend.username }}</span>
            </a>
          } @empty {
            <div class="contacts-empty">{{ 'friendsPage.noFriendsDesc' | translate }}</div>
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    /* === Three-column Facebook layout === */
    .feed-layout {
      display: flex;
      justify-content: center;
      max-width: 1440px;
      margin: 0 auto;
      padding-top: 16px;
    }

    /* Left Sidebar */
    .sidebar-left {
      position: sticky;
      top: 72px;
      width: 280px;
      max-height: calc(100vh - 72px);
      overflow-y: auto;
      padding: 0 8px;
      flex-shrink: 0;
    }
    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      text-decoration: none;
      color: #050505;
      font-size: 15px;
      font-weight: 500;
      transition: background 0.15s;
    }
    .sidebar-item:hover { background: #e4e6e9; }
    .sidebar-profile { margin-bottom: 4px; }
    .sidebar-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      flex-shrink: 0;
    }
    .sidebar-avatar-img {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .sidebar-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      font-size: 20px;
      flex-shrink: 0;
    }

    /* Center Feed */
    .feed-center {
      flex: 1;
      max-width: 680px;
      min-width: 0;
    }
    .feed-container {
      padding: 0 16px;
    }

    /* Right Sidebar */
    .sidebar-right {
      position: sticky;
      top: 72px;
      width: 280px;
      max-height: calc(100vh - 72px);
      overflow-y: auto;
      padding: 0 16px 0 8px;
      flex-shrink: 0;
    }
    .contacts-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px 8px;
    }
    .contacts-title {
      font-size: 17px;
      font-weight: 600;
      color: #65676b;
    }
    .contact-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      text-decoration: none;
      color: #050505;
      font-size: 15px;
      font-weight: 500;
      transition: background 0.15s;
    }
    .contact-item:hover { background: #e4e6e9; }
    .contact-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      flex-shrink: 0;
    }
    .contact-avatar-img {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .contact-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .contacts-empty {
      padding: 12px;
      color: #65676b;
      font-size: 14px;
    }

    /* Feed content styles */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #65676b;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #1877f2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error {
      background: #ffebee;
      border: 1px solid #f44336;
      color: #c62828;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 20px;
    }

    .error button {
      margin-top: 10px;
      padding: 8px 16px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }

    .cache-info {
      font-size: 12px;
      color: #65676b;
      text-align: right;
      margin-bottom: 10px;
    }

    .posts {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .empty-feed {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 8px;
      color: #65676b;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .loading-more {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      color: #65676b;
      gap: 10px;
    }

    .spinner-small {
      width: 24px;
      height: 24px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #1877f2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .refresh-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #1877f2;
      color: white;
      border: none;
      font-size: 22px;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(0,0,0,0.2);
      transition: background 0.2s, transform 0.2s;
    }

    .refresh-btn:hover {
      background: #166fe5;
      transform: scale(1.05);
    }

    .scroll-top-btn {
      position: fixed;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 90;
      background: #1877f2;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 6px;
      animation: slideDown 0.3s ease-out;
    }

    .scroll-top-btn:hover {
      background: #166fe5;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .desktop-only { display: flex; flex-direction: column; }

    @media (max-width: 1100px) {
      .sidebar-right { display: none !important; }
      .feed-center { max-width: 680px; }
    }

    @media (max-width: 900px) {
      .sidebar-left { display: none !important; }
      .feed-layout { padding-top: 8px; }
      .feed-container { padding: 0 8px; }
      .posts { gap: 12px; }
    }
  `]
})
export class FeedComponent implements OnInit, OnDestroy {
  feedService = inject(FeedService);
  authService = inject(AuthService);
  router = inject(Router);
  private http = inject(HttpClient);
  private hasRedirected = false;
  showScrollTop = false;
  friendsList = signal<FriendInfo[]>([]);

  constructor() {
    // Reaktiv auf User-Rolle reagieren
    effect(() => {
      const user = this.authService.currentUser();

      // Nur wenn User geladen ist
      if (user && !this.hasRedirected) {
        // Admins auf Admin-Panel weiterleiten
        if (this.authService.isAdmin()) {
          this.hasRedirected = true;
          setTimeout(() => this.router.navigate(['/admin-panel']), 0);
          return;
        }

        // Moderatoren auf Moderation-Seite weiterleiten
        if (this.authService.isModerator()) {
          this.hasRedirected = true;
          setTimeout(() => this.router.navigate(['/admin']), 0);
          return;
        }

        // Normale User: Feed laden
        if (!this.hasRedirected) {
          setTimeout(() => this.feedService.startAutoRefresh(), 0);
        }
      }
    });
  }

  ngOnInit(): void {
    this.loadFriendsList();
  }

  private loadFriendsList(): void {
    this.http.get<{friends: FriendInfo[]}>('/api/friends').subscribe({
      next: (response) => this.friendsList.set(response.friends),
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.feedService.stopAutoRefresh();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    // Show scroll-top button when scrolled down more than 300px
    this.showScrollTop = window.scrollY > 300;

    // Prüfe ob User fast am Ende der Seite ist
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;
    const threshold = 300; // 300px vor Ende

    if (scrollPosition >= pageHeight - threshold) {
      this.loadMore();
    }
  }

  refresh(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.feedService.loadFeed(true);
  }

  loadMore(): void {
    this.feedService.loadMore();
  }

  onPostCreated(post: Post): void {
    console.log('Post created:', post);
  }

  onLike(post: Post): void {
    this.feedService.likePost(post.author_uid, post.post_id).subscribe();
  }

  onUnlike(post: Post): void {
    this.feedService.unlikePost(post.author_uid, post.post_id).subscribe();
  }

  onDelete(post: Post): void {
    this.feedService.deletePost(post.post_id).subscribe();
  }
}
