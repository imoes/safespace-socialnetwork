import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Post } from '../../services/feed.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-my-posts',
  standalone: true,
  imports: [CommonModule, PostCardComponent, TranslatePipe],
  template: `
    <div class="my-posts-container">
      <div class="page-header">
        <h1>📝 {{ 'myPosts.title' | translate }}</h1>
        <p class="subtitle">{{ 'myPosts.subtitle' | translate }}</p>

        <div class="tabs">
          <button
            class="tab"
            [class.active]="activeTab === 'my-posts'"
            (click)="switchTab('my-posts')">
            📝 {{ 'myPosts.tabMyPosts' | translate }}
          </button>
          <button
            class="tab"
            [class.active]="activeTab === 'commented'"
            (click)="switchTab('commented')">
            💬 {{ 'myPosts.tabCommented' | translate }}
          </button>
        </div>
      </div>

      @if (loading && posts.length === 0) {
        <div class="loading">
          <div class="spinner"></div>
          <p>{{ 'myPosts.loading' | translate }}</p>
        </div>
      }

      @if (!loading && posts.length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h2>{{ 'myPosts.noPosts' | translate }}</h2>
          <p>{{ 'myPosts.noPostsDesc' | translate }}</p>
        </div>
      }

      <div class="posts-list">
        @for (post of posts; track post.post_id) {
          <div [class.highlighted-post]="highlightedPostId() === post.post_id" [id]="'post-' + post.post_id">
            <app-post-card
              [post]="post"
              [currentUid]="currentUid"
              [expandComments]="highlightedPostId() === post.post_id"
              (like)="likePost(post)"
              (unlike)="unlikePost(post)"
              (delete)="deletePost(post)"
            ></app-post-card>
          </div>
        }
      </div>

      @if (loading && posts.length > 0) {
        <div class="loading-more">
          <div class="spinner"></div>
          <p>{{ 'myPosts.loadingMore' | translate }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .my-posts-container {
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
      margin: 0 0 20px 0;
      color: #65676b;
      font-size: 14px;
    }

    .tabs {
      display: flex;
      gap: 8px;
      justify-content: center;
    }

    .tab {
      padding: 10px 20px;
      border: none;
      background: #f0f2f5;
      color: #65676b;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .tab:hover {
      background: #e4e6e9;
    }

    .tab.active {
      background: #1877f2;
      color: white;
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

    .highlighted-post {
      animation: highlight-pulse 2s ease-in-out;
      border-radius: 12px;
    }

    @keyframes highlight-pulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(24, 119, 242, 0);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(24, 119, 242, 0.3);
      }
    }
  `]
})
export class MyPostsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);

  posts: Post[] = [];
  loading = false;
  hasMore = true;
  currentUid?: number;
  activeTab: 'my-posts' | 'commented' = 'my-posts';
  private offset = 0;
  private readonly limit = 15;
  highlightedPostId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadPosts();

    // Check for highlight query parameter - subscribe to changes
    this.route.queryParams.subscribe(params => {
      const highlightId = params['highlight'];
      if (highlightId) {
        const postId = +highlightId;
        this.highlightedPostId.set(postId);

        // Stelle sicher, dass wir auf "Meine Posts" Tab sind
        if (this.activeTab !== 'my-posts') {
          this.activeTab = 'my-posts';
          this.posts = [];
          this.offset = 0;
          this.hasMore = true;
          this.loadPosts();
        }

        // Scroll to post after a short delay to ensure it's rendered
        setTimeout(() => {
          this.scrollToPost(postId);
        }, 800);
      } else {
        // Clear highlight if no parameter
        this.highlightedPostId.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
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
    const endpoint = this.activeTab === 'my-posts'
      ? `/api/users/me/posts?limit=${this.limit}&offset=${this.offset}`
      : `/api/users/me/commented-posts?limit=${this.limit}&offset=${this.offset}`;

    this.http.get<{ posts: Post[], has_more: boolean }>(endpoint).subscribe({
      next: (response) => {
        this.posts = [...this.posts, ...response.posts];
        this.hasMore = response.has_more;
        this.loading = false;
      },
      error: (err) => {
        console.error('Fehler beim Laden der Posts:', err);
        this.loading = false;
      }
    });
  }

  switchTab(tab: 'my-posts' | 'commented'): void {
    if (this.activeTab === tab) return;

    this.activeTab = tab;
    this.posts = [];
    this.offset = 0;
    this.hasMore = true;
    this.loadPosts();
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

  private scrollToPost(postId: number): void {
    const element = document.getElementById(`post-${postId}`);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        this.highlightedPostId.set(null);
      }, 5000);
    } else {
      // Retry after posts might have loaded
      setTimeout(() => {
        const retryElement = document.getElementById(`post-${postId}`);
        if (retryElement) {
          retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => this.highlightedPostId.set(null), 5000);
        } else {
          // Post not on current page, clear highlight silently
          this.highlightedPostId.set(null);
        }
      }, 1000);
    }
  }
}
