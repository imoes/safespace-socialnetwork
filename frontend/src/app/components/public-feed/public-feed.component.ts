import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Post } from '../../services/feed.service';
import { PostCardComponent } from '../post-card/post-card.component';

@Component({
  selector: 'app-public-feed',
  standalone: true,
  imports: [CommonModule, PostCardComponent],
  template: `
    <div class="public-feed-container">
      <div class="page-header">
        <h1>🌍 Öffentliche Posts</h1>
        <p class="subtitle">Entdecke öffentliche Beiträge aus der Community</p>
      </div>

      @if (loading && posts.length === 0) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Lade öffentliche Posts...</p>
        </div>
      }

      @if (!loading && posts.length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h2>Keine öffentlichen Posts</h2>
          <p>Es sind noch keine öffentlichen Posts vorhanden.</p>
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

      @if (hasMore && !loading) {
        <div class="load-more">
          <button class="btn-load-more" (click)="loadMore()">
            Weitere 25 Posts laden
          </button>
          <p class="posts-count">{{ posts.length }} von {{ total }} Posts angezeigt</p>
        </div>
      }

      @if (loading && posts.length > 0) {
        <div class="loading-more">
          <div class="spinner"></div>
        </div>
      }
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

    .load-more {
      text-align: center;
      padding: 20px;
    }

    .btn-load-more {
      padding: 12px 32px;
      background: #1877f2;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      margin-bottom: 8px;
    }

    .btn-load-more:hover {
      background: #166fe5;
    }

    .posts-count {
      margin: 0;
      color: #65676b;
      font-size: 13px;
    }

    .loading-more {
      text-align: center;
      padding: 20px;
    }

    .loading-more .spinner {
      width: 32px;
      height: 32px;
      border-width: 3px;
    }
  `]
})
export class PublicFeedComponent implements OnInit {
  private http = inject(HttpClient);

  posts: Post[] = [];
  loading = false;
  hasMore = true;
  total = 0;
  currentUid?: number;
  private offset = 0;
  private readonly limit = 25;

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadPosts();
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
        console.error('Fehler beim Laden der öffentlichen Posts:', err);
        this.loading = false;
      }
    });
  }

  loadMore(): void {
    this.offset += this.limit;
    this.loadPosts();
  }

  likePost(post: Post): void {
    this.http.post(`/api/feed/${post.author_uid}/${post.post_id}/like`, {}).subscribe({
      next: () => {
        post.likes_count++;
      },
      error: () => {
        alert('Fehler beim Liken');
      }
    });
  }

  unlikePost(post: Post): void {
    this.http.delete(`/api/feed/${post.author_uid}/${post.post_id}/like`).subscribe({
      next: () => {
        post.likes_count = Math.max(0, post.likes_count - 1);
      },
      error: () => {
        alert('Fehler beim Unlike');
      }
    });
  }

  deletePost(post: Post): void {
    this.http.delete(`/api/feed/${post.post_id}`).subscribe({
      next: () => {
        this.posts = this.posts.filter(p => p.post_id !== post.post_id);
      },
      error: () => {
        alert('Fehler beim Löschen');
      }
    });
  }
}
