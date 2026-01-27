import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Post } from '../../services/feed.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-recent-posts-ticker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ticker-container" *ngIf="recentPosts.length > 0">
      <div class="ticker-label">📰</div>
      <div class="ticker-track">
        <div class="ticker-content" [class.paused]="isPaused" (mouseenter)="isPaused = true" (mouseleave)="isPaused = false">
          @for (post of displayPosts; track post.post_id + '_' + $index) {
            <span class="ticker-item" (click)="goToPost(post)">
              <strong class="ticker-username" (click)="goToProfile(post.author_uid, $event)">{{ post.author_username }}</strong>:
              {{ truncate(post.content, 80) }}
              <span class="ticker-meta">❤️ {{ post.likes_count }} 💬 {{ post.comments_count }}</span>
            </span>
            <span class="ticker-separator">•</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ticker-container {
      display: flex;
      align-items: center;
      background: linear-gradient(135deg, #f0f2f5, #e4e6eb);
      border-bottom: 1px solid #dddfe2;
      overflow: hidden;
      height: 36px;
      position: relative;
    }

    .ticker-label {
      flex-shrink: 0;
      padding: 0 12px;
      font-size: 16px;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      height: 100%;
      display: flex;
      align-items: center;
      z-index: 1;
    }

    .ticker-track {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .ticker-content {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      animation: ticker-scroll 40s linear infinite;
      padding-left: 100%;
    }

    .ticker-content.paused {
      animation-play-state: paused;
    }

    @keyframes ticker-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .ticker-item {
      cursor: pointer;
      font-size: 13px;
      color: #1c1e21;
      padding: 0 8px;
      transition: color 0.2s;
    }

    .ticker-item:hover {
      color: #1877f2;
    }

    .ticker-username {
      color: #1877f2;
      font-weight: 600;
    }

    .ticker-username:hover {
      text-decoration: underline;
    }

    .ticker-meta {
      font-size: 11px;
      color: #65676b;
      margin-left: 6px;
    }

    .ticker-separator {
      color: #bec3c9;
      margin: 0 4px;
      font-size: 12px;
    }
  `]
})
export class RecentPostsTickerComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);

  recentPosts: Post[] = [];
  displayPosts: Post[] = [];
  isPaused = false;

  private refreshSub?: Subscription;

  ngOnInit(): void {
    this.loadRecentPosts();
    // Refresh every 60 seconds
    this.refreshSub = interval(60000).subscribe(() => this.loadRecentPosts());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private loadRecentPosts(): void {
    this.http.get<{ posts: Post[], total: number, has_more: boolean }>(
      '/api/public-feed?limit=10&offset=0'
    ).subscribe({
      next: (response) => {
        this.recentPosts = response.posts;
        // Duplicate for seamless loop
        this.displayPosts = [...this.recentPosts, ...this.recentPosts];
      },
      error: () => {
        // Silently fail - ticker is not critical
      }
    });
  }

  truncate(text: string, maxLength: number): string {
    if (!text) return '';
    // Strip newlines for ticker display
    const singleLine = text.replace(/\n/g, ' ').trim();
    if (singleLine.length <= maxLength) return singleLine;
    return singleLine.substring(0, maxLength) + '...';
  }

  goToPost(post: Post): void {
    this.router.navigate(['/profile', post.author_uid]);
  }

  goToProfile(uid: number, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/profile', uid]);
  }
}
