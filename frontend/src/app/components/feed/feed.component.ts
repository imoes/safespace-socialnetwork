import { Component, OnInit, OnDestroy, inject, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FeedService, Post } from '../../services/feed.service';
import { AuthService } from '../../services/auth.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { CreatePostComponent } from '../create-post/create-post.component';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, PostCardComponent, CreatePostComponent],
  template: `
    <div class="feed-container">
      <!-- Create Post -->
      <app-create-post (postCreated)="onPostCreated($event)" />

      <!-- Loading indicator -->
      @if (feedService.isLoading()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Lade Feed...</p>
        </div>
      }

      <!-- Error message -->
      @if (feedService.error()) {
        <div class="error">
          <p>{{ feedService.error() }}</p>
          <button (click)="refresh()">Erneut versuchen</button>
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
              <p>Noch keine Posts vorhanden.</p>
              <p>Füge Freunde hinzu oder erstelle deinen ersten Post!</p>
            </div>
          }
        }
      </div>

      <!-- Loading more indicator -->
      @if (feedService.isLoading() && feedService.posts().length > 0) {
        <div class="loading-more">
          <div class="spinner-small"></div>
          <p>Lade weitere Posts...</p>
        </div>
      }

      <!-- Refresh button -->
      <button class="refresh-btn" (click)="refresh()" title="Feed aktualisieren">
        ↻
      </button>
    </div>
  `,
  styles: [`
    .feed-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #666;
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
      border-radius: 4px;
      cursor: pointer;
    }

    .cache-info {
      font-size: 12px;
      color: #666;
      text-align: right;
      margin-bottom: 10px;
    }

    .posts {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .empty-feed {
      text-align: center;
      padding: 40px;
      background: #f5f5f5;
      border-radius: 8px;
      color: #666;
    }

    .loading-more {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      color: #666;
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
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #1877f2;
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

    .refresh-btn:hover {
      background: #166fe5;
    }
  `]
})
export class FeedComponent implements OnInit, OnDestroy {
  feedService = inject(FeedService);
  authService = inject(AuthService);
  router = inject(Router);
  private hasRedirected = false;

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
    // Wird vom effect übernommen
  }

  ngOnDestroy(): void {
    this.feedService.stopAutoRefresh();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
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
    if (confirm('Post wirklich löschen?')) {
      this.feedService.deletePost(post.post_id).subscribe();
    }
  }
}
