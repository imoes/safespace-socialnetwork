import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Post } from '../../services/feed.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-public-feed',
  standalone: true,
  imports: [CommonModule, PostCardComponent, TranslatePipe],
  template: `
    <div class="public-feed-container">
      <div class="page-header">
        <h1>🌍 {{ 'publicFeed.title' | translate }}</h1>
        <p class="subtitle">{{ 'publicFeed.subtitle' | translate }}</p>
      </div>

      @if (loading && posts.length === 0) {
        <div class="loading">
          <div class="spinner"></div>
          <p>{{ 'publicFeed.loading' | translate }}</p>
        </div>
      }

      @if (!loading && posts.length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h2>{{ 'publicFeed.noPosts' | translate }}</h2>
          <p>{{ 'publicFeed.noPostsDesc' | translate }}</p>
        </div>
      }

      <div class="posts-list">
        @for (post of posts; track post.post_id) {
          <app-post-card
            [post]="post"
            [currentUid]="currentUid"
            (like)="likePost(post)"
            (unlike)="unlikePost(post)"
            (delete)="deletePost(post)"
          ></app-post-card>
        }
      </div>

      @if (loading && posts.length > 0) {
        <div class="loading-more">
          <div class="spinner"></div>
          <p>{{ 'publicFeed.loadingMore' | translate }}</p>
        </div>
      }

      @if (!loading && !hasMore && posts.length > 0) {
        <div class="end-message">
          <p>{{ 'publicFeed.allSeen' | translate }}</p>
        </div>
      }

      <button class="refresh-btn" (click)="refresh()" [title]="'common.refresh' | translate">
        ↻
      </button>
    </div>
  `,
  styles: [`
    .public-feed-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }

    .page-header {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }

    .page-header h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #1877f2;
    }

    .subtitle {
      margin: 0;
      color: #65676b;
      font-size: 14px;
    }

    .loading {
      text-align: center;
      padding: 60px 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f0f2f5;
      border-top-color: #1877f2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading p {
      color: #65676b;
      font-size: 14px;
    }

    .empty-state {
      background: white;
      border-radius: 12px;
      padding: 60px 20px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .empty-state h2 {
      margin: 0 0 8px 0;
      color: #1c1e21;
    }

    .empty-state p {
      margin: 0;
      color: #65676b;
    }

    .posts-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .loading-more {
      text-align: center;
      padding: 20px;
    }

    .loading-more .spinner {
      width: 32px;
      height: 32px;
      border-width: 3px;
      margin: 0 auto 8px;
    }

    .loading-more p {
      color: #65676b;
      font-size: 14px;
      margin: 0;
    }

    .end-message {
      text-align: center;
      padding: 30px 20px;
    }

    .end-message p {
      color: #65676b;
      font-size: 15px;
      margin: 0;
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
      z-index: 10;
    }

    .refresh-btn:hover {
      background: #166fe5;
    }
  `]
})
export class PublicFeedComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);

  posts: Post[] = [];
  loading = false;
  hasMore = true;
  total = 0;
  currentUid?: number;
  private offset = 0;
  private readonly limit = 15;
  private readonly REFRESH_INTERVAL = 30000;
  private refreshTimer: any;

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadPosts();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => {
      this.silentRefresh();
    }, this.REFRESH_INTERVAL);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private silentRefresh(): void {
    this.http.get<{ posts: Post[], total: number, has_more: boolean }>(
      `/api/public-feed?limit=${this.limit}&offset=0`
    ).subscribe({
      next: (response) => {
        this.posts = response.posts;
        this.total = response.total;
        this.hasMore = response.has_more;
        this.offset = 0;
      }
    });
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    // Prüfe ob User fast am Ende der Seite ist
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;
    const threshold = 300; // 300px vor Ende

    if (scrollPosition >= pageHeight - threshold && this.hasMore && !this.loading) {
      this.loadMore();
    }
  }

  private loadCurrentUser(): void {
    this.http.get<any>('/api/auth/me').subscribe({
      next: (user) => {
        this.currentUid = user.uid;
      }
    });
  }

  private loadPosts(): void {
    if (this.loading) return;

    this.loading = true;
    this.http.get<{ posts: Post[], total: number, has_more: boolean }>(
      `/api/public-feed?limit=${this.limit}&offset=${this.offset}`
    ).subscribe({
      next: (response) => {
        this.posts = [...this.posts, ...response.posts];
        this.total = response.total;
        this.hasMore = response.has_more;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading public posts:', err);
        this.loading = false;
      }
    });
  }

  loadMore(): void {
    this.offset += this.limit;
    this.loadPosts();
  }

  likePost(post: Post): void {
    this.http.post<{liked: boolean}>(`/api/feed/${post.author_uid}/${post.post_id}/like`, {}).subscribe({
      next: (response) => {
        if (response.liked) {
          post.likes_count++;
        }
        post.is_liked_by_user = true;
      },
      error: () => {
        alert(this.i18n.t('errors.like'));
      }
    });
  }

  unlikePost(post: Post): void {
    this.http.delete<{unliked: boolean}>(`/api/feed/${post.author_uid}/${post.post_id}/like`).subscribe({
      next: (response) => {
        if (response.unliked) {
          post.likes_count = Math.max(0, post.likes_count - 1);
        }
        post.is_liked_by_user = false;
      },
      error: () => {
        alert(this.i18n.t('errors.unlike'));
      }
    });
  }

  refresh(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.posts = [];
    this.offset = 0;
    this.hasMore = true;
    this.loadPosts();
  }

  deletePost(post: Post): void {
    this.http.delete(`/api/feed/${post.post_id}`).subscribe({
      next: () => {
        this.posts = this.posts.filter(p => p.post_id !== post.post_id);
      },
      error: () => {
        alert(this.i18n.t('errors.delete'));
      }
    });
  }
}
