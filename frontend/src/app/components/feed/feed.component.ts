import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

      <!-- Load more -->
      @if (feedService.hasMore()) {
        <button class="load-more" (click)="loadMore()" [disabled]="feedService.isLoading()">
          📜 Frühere Posts laden
        </button>
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

    .load-more {
      display: block;
      width: 100%;
      padding: 12px;
      margin-top: 20px;
      background: #1877f2;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    }

    .load-more:disabled {
      background: #ccc;
      cursor: not-allowed;
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

  ngOnInit(): void {
    this.feedService.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.feedService.stopAutoRefresh();
  }

  refresh(): void {
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
