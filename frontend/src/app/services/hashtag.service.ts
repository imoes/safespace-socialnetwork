import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HashtagStat {
  hashtag: string;
  count: number;
}

export interface HashtagPost {
  post_id: number;
  author_uid: number;
  author_username: string;
  author_first_name: string | null;
  author_last_name: string | null;
  content: string;
  hashtags: string[];
  media_urls: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class HashtagService {
  private readonly API_URL = '/api/hashtags';

  constructor(private http: HttpClient) {}

  /**
   * Get trending hashtags
   */
  getTrendingHashtags(limit: number = 20, hours: number = 24): Observable<HashtagStat[]> {
    return this.http.get<HashtagStat[]>(`${this.API_URL}/trending?limit=${limit}&hours=${hours}`);
  }

  /**
   * Autocomplete hashtags by prefix
   */
  autocompleteHashtags(query: string, limit: number = 10): Observable<HashtagStat[]> {
    if (query.length < 2) {
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }
    return this.http.get<HashtagStat[]>(`${this.API_URL}/autocomplete?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  /**
   * Search for posts by hashtag with pagination
   */
  searchByHashtag(hashtag: string, limit: number = 50, offset: number = 0): Observable<{posts: HashtagPost[], has_more: boolean, total: number}> {
    // Remove # if present
    const cleanHashtag = hashtag.startsWith('#') ? hashtag.substring(1) : hashtag;
    return this.http.get<{posts: HashtagPost[], has_more: boolean, total: number}>(
      `${this.API_URL}/search/${encodeURIComponent(cleanHashtag)}?limit=${limit}&offset=${offset}`
    );
  }
}
