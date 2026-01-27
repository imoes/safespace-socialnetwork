import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HashtagService, HashtagPost } from '../../services/hashtag.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../../services/feed.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-hashtag-detail',
  standalone: true,
  imports: [CommonModule, PostCardComponent, TranslatePipe],
  template: `
    <div class="hashtag-detail-container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">← {{ 'common.back' | translate }}</button>
        <h2>#{{ hashtag }}</h2>
        @if (totalPosts() > 0) {
          <p class="subtitle">{{ totalPosts() }} {{ 'common.posts' | translate }}</p>
        }
      </div>

      @if (loadingInitial()) {
        <div class="loading">{{ 'hashtagDetail.loading' | translate }}</div>
      } @else if (posts().length === 0) {
        <div class="empty-state">
          <h3>{{ 'hashtagDetail.noPosts' | translate }}</h3>
          <p>{{ 'hashtagDetail.noPostsDesc' | translate }}</p>
        </div>
      } @else {
        <!-- Load More at Top -->
        @if (loadingTop()) {
          <div class="load-more-indicator">{{ 'hashtagDetail.loadingOlder' | translate }}</div>
        }

        <!-- Posts List -->
        <div class="posts-list">
          @for (post of posts(); track post.post_id) {
            <app-post-card [post]="convertToPost(post)"></app-post-card>
          }
        </div>

        <!-- Load More at Bottom -->
        @if (loadingBottom()) {
          <div class="load-more-indicator">{{ 'hashtagDetail.loadingNewer' | translate }}</div>
        }

        @if (!hasMore() && posts().length > 0) {
          <div class="end-message">{{ 'hashtagDetail.noMore' | translate }}</div>
        }
      }

      <button class="refresh-btn" (click)="refresh()" [title]="'common.refresh' | translate">
        ↻
      </button>
    </div>
  `,
  styles: [`
    .hashtag-detail-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      margin-bottom: 24px;
      text-align: center;
    }

    .back-btn {
      float: left;
      padding: 8px 16px;
      background: #f0f2f5;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      color: #1877f2;
      transition: background 0.2s;
    }

    .back-btn:hover {
      background: #e4e6e9;
    }

    h2 {
      margin: 0 0 8px 0;
      color: #1877f2;
      font-size: 32px;
      font-weight: 700;
    }

    .subtitle {
      margin: 0;
      color: #65676b;
      font-size: 14px;
    }

    .loading, .empty-state {
      text-align: center;
      padding: 40px;
      color: #65676b;
    }

    .empty-state h3 {
      color: #333;
      margin-bottom: 8px;
    }

    .posts-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .load-more-indicator {
      text-align: center;
      padding: 20px;
      color: #1877f2;
      font-weight: 500;
    }

    .end-message {
      text-align: center;
      padding: 20px;
      color: #65676b;
      font-size: 14px;
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
export class HashtagDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private hashtagService = inject(HashtagService);
  private i18n = inject(I18nService);

  hashtag: string = '';
  posts = signal<HashtagPost[]>([]);
  totalPosts = signal(0);
  loadingInitial = signal(true);
  loadingTop = signal(false);
  loadingBottom = signal(false);
  hasMore = signal(true);

  private readonly LIMIT = 15;
  private currentOffset = 0;
  private isLoadingMore = false;
  private readonly REFRESH_INTERVAL = 30000;
  private refreshTimer: any;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.hashtag = params['hashtag'];
      if (this.hashtag) {
        this.loadPosts();
        this.startAutoRefresh();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
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
    this.hashtagService.searchByHashtag(this.hashtag, this.LIMIT, 0).subscribe({
      next: (response) => {
        this.posts.set(response.posts);
        this.hasMore.set(response.has_more);
        this.totalPosts.set(response.total);
        this.currentOffset = 0;
      }
    });
  }

  loadPosts(): void {
    this.loadingInitial.set(true);
    this.currentOffset = 0;

    this.hashtagService.searchByHashtag(this.hashtag, this.LIMIT, 0).subscribe({
      next: (response) => {
        this.posts.set(response.posts);
        this.hasMore.set(response.has_more);
        this.totalPosts.set(response.total);
        this.loadingInitial.set(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der Posts:', err);
        this.loadingInitial.set(false);
      }
    });
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    if (this.isLoadingMore) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    // Load more at bottom
    if (scrollTop + clientHeight >= scrollHeight - 200 && this.hasMore() && !this.loadingBottom()) {
      this.loadMoreBottom();
    }

    // Load more at top
    if (scrollTop < 200 && this.currentOffset > 0 && !this.loadingTop()) {
      this.loadMoreTop();
    }
  }

  loadMoreBottom(): void {
    if (!this.hasMore() || this.isLoadingMore) return;

    this.isLoadingMore = true;
    this.loadingBottom.set(true);
    this.currentOffset += this.LIMIT;

    this.hashtagService.searchByHashtag(this.hashtag, this.LIMIT, this.currentOffset).subscribe({
      next: (response) => {
        this.posts.update(current => [...current, ...response.posts]);
        this.hasMore.set(response.has_more);
        this.loadingBottom.set(false);
        this.isLoadingMore = false;
      },
      error: (err) => {
        console.error('Fehler beim Laden weiterer Posts:', err);
        this.loadingBottom.set(false);
        this.isLoadingMore = false;
      }
    });
  }

  loadMoreTop(): void {
    if (this.currentOffset === 0 || this.isLoadingMore) return;

    this.isLoadingMore = true;
    this.loadingTop.set(true);
    
    const newOffset = Math.max(0, this.currentOffset - this.LIMIT);
    
    this.hashtagService.searchByHashtag(this.hashtag, this.LIMIT, newOffset).subscribe({
      next: (response) => {
        this.posts.update(current => [...response.posts, ...current]);
        this.currentOffset = newOffset;
        this.loadingTop.set(false);
        this.isLoadingMore = false;
      },
      error: (err) => {
        console.error('Fehler beim Laden älterer Posts:', err);
        this.loadingTop.set(false);
        this.isLoadingMore = false;
      }
    });
  }

  convertToPost(hashtagPost: HashtagPost): Post {
    // Convert HashtagPost to Post format for PostCardComponent
    return {
      post_id: hashtagPost.post_id,
      author_uid: hashtagPost.author_uid,
      author_username: hashtagPost.author_username,
      author_profile_picture: undefined,
      content: hashtagPost.content,
      media_urls: hashtagPost.media_urls,
      visibility: 'public',
      created_at: hashtagPost.created_at,
      likes_count: hashtagPost.likes_count,
      comments_count: hashtagPost.comments_count
    };
  }

  refresh(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadPosts();
  }

  goBack(): void {
    this.router.navigate(['/hashtags']);
  }
}
