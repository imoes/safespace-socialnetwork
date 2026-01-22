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
  getTrendingHashtags(limit: number = 20): Observable<HashtagStat[]> {
    return this.http.get<HashtagStat[]>(`${this.API_URL}/trending?limit=${limit}`);
  }

  /**
   * Search for posts by hashtag
   */
  searchByHashtag(hashtag: string, limit: number = 50): Observable<HashtagPost[]> {
    // Remove # if present
    const cleanHashtag = hashtag.startsWith('#') ? hashtag.substring(1) : hashtag;
    return this.http.get<HashtagPost[]>(`${this.API_URL}/search/${encodeURIComponent(cleanHashtag)}?limit=${limit}`);
  }
}
