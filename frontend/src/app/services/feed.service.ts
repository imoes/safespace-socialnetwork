import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, interval, Subscription, tap, catchError, of, switchMap } from 'rxjs';

export interface Post {
  post_id: number;
  author_uid: number;
  author_username: string;
  content: string;
  media_urls: string[];
  visibility: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

export interface FeedResponse {
  posts: Post[];
  has_more: boolean;
  cached_at: string | null;
}

export interface Comment {
  comment_id: number;
  post_id: number;
  user_uid: number;
  author_username: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_liked_by_user: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FeedService implements OnDestroy {
  private readonly API_URL = '/api/feed';
  private readonly REFRESH_INTERVAL = 30000; // 30 Sekunden

  // Signals
  private postsSignal = signal<Post[]>([]);
  private isLoadingSignal = signal(false);
  private hasMoreSignal = signal(false);
  private cachedAtSignal = signal<string | null>(null);
  private errorSignal = signal<string | null>(null);

  // Computed
  readonly posts = computed(() => this.postsSignal());
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly hasMore = computed(() => this.hasMoreSignal());
  readonly cachedAt = computed(() => this.cachedAtSignal());
  readonly error = computed(() => this.errorSignal());

  // Auto-refresh subscription
  private refreshSubscription?: Subscription;

  constructor(private http: HttpClient) {}

  /**
   * Startet das automatische Laden des Feeds alle 30 Sekunden
   */
  startAutoRefresh(): void {
    // Initial laden
    this.loadFeed();

    // Alle 30 Sekunden refreshen
    this.refreshSubscription = interval(this.REFRESH_INTERVAL).pipe(
      switchMap(() => this.fetchFeed(false))
    ).subscribe({
      next: (response) => this.updateFeed(response),
      error: (err) => this.errorSignal.set('Failed to refresh feed')
    });
  }

  /**
   * Stoppt den Auto-Refresh
   */
  stopAutoRefresh(): void {
    this.refreshSubscription?.unsubscribe();
  }

  /**
   * Lädt den Feed manuell (z.B. beim Pull-to-Refresh)
   */
  loadFeed(forceRefresh = false): void {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    this.fetchFeed(forceRefresh).subscribe({
      next: (response) => this.updateFeed(response),
      error: (err) => {
        this.errorSignal.set('Failed to load feed');
        this.isLoadingSignal.set(false);
      }
    });
  }

  /**
   * Lädt mehr Posts (Pagination)
   */
  loadMore(): void {
    if (this.isLoadingSignal() || !this.hasMoreSignal()) return;

    const currentPosts = this.postsSignal();
    this.isLoadingSignal.set(true);

    const params = new HttpParams()
      .set('offset', currentPosts.length.toString())
      .set('limit', '50');

    this.http.get<FeedResponse>(this.API_URL, { params }).subscribe({
      next: (response) => {
        this.postsSignal.update(posts => [...posts, ...response.posts]);
        this.hasMoreSignal.set(response.has_more);
        this.isLoadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set('Failed to load more posts');
        this.isLoadingSignal.set(false);
      }
    });
  }

  /**
   * Erstellt einen neuen Post
   */
  createPost(content: string, visibility = 'friends'): Observable<Post> {
    return this.http.post<Post>(this.API_URL, { content, visibility }).pipe(
      tap(newPost => {
        // Post vorne einfügen
        this.postsSignal.update(posts => [newPost, ...posts]);
      })
    );
  }

  /**
   * Erstellt einen Post mit Media
   */
  createPostWithMedia(content: string, files: File[], visibility = 'friends'): Observable<Post> {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('visibility', visibility);
    files.forEach(file => formData.append('files', file));

    return this.http.post<Post>(`${this.API_URL}/with-media`, formData).pipe(
      tap(newPost => {
        this.postsSignal.update(posts => [newPost, ...posts]);
      })
    );
  }

  /**
   * Löscht einen Post
   */
  deletePost(postId: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${postId}`).pipe(
      tap(() => {
        this.postsSignal.update(posts =>
          posts.filter(p => p.post_id !== postId)
        );
      })
    );
  }

  /**
   * Aktualisiert die Sichtbarkeit eines Posts
   */
  updatePostVisibility(postId: number, visibility: string): Observable<Post> {
    return this.http.patch<Post>(`${this.API_URL}/${postId}/visibility`, { visibility }).pipe(
      tap(updatedPost => {
        this.postsSignal.update(posts =>
          posts.map(p =>
            p.post_id === postId
              ? { ...p, visibility: updatedPost.visibility }
              : p
          )
        );
      })
    );
  }

  /**
   * Liked einen Post
   */
  likePost(authorUid: number, postId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${authorUid}/${postId}/like`, {}).pipe(
      tap(() => {
        this.postsSignal.update(posts =>
          posts.map(p => 
            p.post_id === postId && p.author_uid === authorUid
              ? { ...p, likes_count: p.likes_count + 1 }
              : p
          )
        );
      })
    );
  }

  /**
   * Entfernt Like
   */
  unlikePost(authorUid: number, postId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${authorUid}/${postId}/like`).pipe(
      tap(() => {
        this.postsSignal.update(posts =>
          posts.map(p =>
            p.post_id === postId && p.author_uid === authorUid
              ? { ...p, likes_count: Math.max(0, p.likes_count - 1) }
              : p
          )
        );
      })
    );
  }

  /**
   * Lädt Kommentare eines Posts
   */
  getComments(authorUid: number, postId: number): Observable<{ comments: Comment[] }> {
    return this.http.get<{ comments: Comment[] }>(
      `${this.API_URL}/${authorUid}/${postId}/comments`
    );
  }

  /**
   * Fügt Kommentar hinzu
   */
  addComment(authorUid: number, postId: number, content: string): Observable<Comment> {
    return this.http.post<Comment>(
      `${this.API_URL}/${authorUid}/${postId}/comment`,
      null,
      { params: { content } }
    ).pipe(
      tap(() => {
        // Comments count erhöhen
        this.postsSignal.update(posts =>
          posts.map(p =>
            p.post_id === postId && p.author_uid === authorUid
              ? { ...p, comments_count: p.comments_count + 1 }
              : p
          )
        );
      })
    );
  }

  /**
   * Liked einen Kommentar
   */
  likeComment(authorUid: number, postId: number, commentId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${authorUid}/${postId}/comment/${commentId}/like`, {});
  }

  /**
   * Entfernt Like von Kommentar
   */
  unlikeComment(authorUid: number, postId: number, commentId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${authorUid}/${postId}/comment/${commentId}/like`);
  }

  private fetchFeed(forceRefresh: boolean): Observable<FeedResponse> {
    const params = new HttpParams()
      .set('refresh', forceRefresh.toString())
      .set('limit', '50');

    return this.http.get<FeedResponse>(this.API_URL, { params });
  }

  private updateFeed(response: FeedResponse): void {
    this.postsSignal.set(response.posts);
    this.hasMoreSignal.set(response.has_more);
    this.cachedAtSignal.set(response.cached_at);
    this.isLoadingSignal.set(false);
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }
}
