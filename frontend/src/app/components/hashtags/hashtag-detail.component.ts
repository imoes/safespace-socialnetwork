import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HashtagService, HashtagPost } from '../../services/hashtag.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../../services/feed.service';

@Component({
  selector: 'app-hashtag-detail',
  standalone: true,
  imports: [CommonModule, PostCardComponent],
  template: `
    <div class="hashtag-detail-container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">← Zurück</button>
        <h2>#{{ hashtag }}</h2>
        @if (totalPosts() > 0) {
          <p class="subtitle">{{ totalPosts() }} Posts</p>
        }
      </div>

      @if (loadingInitial()) {
        <div class="loading">Posts werden geladen...</div>
      } @else if (posts().length === 0) {
        <div class="empty-state">
          <h3>Keine Posts gefunden</h3>
          <p>Es gibt noch keine Posts mit diesem Hashtag.</p>
        </div>
      } @else {
        <!-- Load More at Top -->
        @if (loadingTop()) {
          <div class="load-more-indicator">Lade ältere Posts...</div>
        }

        <!-- Posts List -->
        <div class="posts-list">
          @for (post of posts(); track post.post_id) {
            <app-post-card [post]="convertToPost(post)"></app-post-card>
          }
        </div>

        <!-- Load More at Bottom -->
        @if (loadingBottom()) {
          <div class="load-more-indicator">Lade neuere Posts...</div>
        }

        @if (!hasMore() && posts().length > 0) {
          <div class="end-message">Keine weiteren Posts</div>
        }
      }
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
  `]
})
export class HashtagDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private hashtagService = inject(HashtagService);

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

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.hashtag = params['hashtag'];
      if (this.hashtag) {
        this.loadPosts();
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
        this.totalPosts.set(response.posts.length);
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

  goBack(): void {
    this.router.navigate(['/hashtags']);
  }
}
