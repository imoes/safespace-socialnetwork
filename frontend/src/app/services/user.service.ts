import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserSearchResult {
  uid: number;
  username: string;
  bio?: string;
  role: string;
  profile_picture?: string;
  is_friend: boolean;
}

export interface UserFriend {
  uid: number;
  username: string;
  profile_picture?: string;
}

export interface UserProfile {
  uid: number;
  username: string;
  bio: string;
  role: string;
  created_at: string;
  profile_picture?: string;
  first_name?: string;
  last_name?: string;
  birthday?: string;
  is_friend?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly API_URL = '/api/users';

  constructor(private http: HttpClient) {}

  /**
   * Sucht nach Benutzern anhand des Suchbegriffs
   */
  searchUsers(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${this.API_URL}/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Lädt ein Benutzerprofil
   */
  getUserProfile(uid: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.API_URL}/${uid}`);
  }

  /**
   * Lädt die Freundesliste eines Benutzers
   */
  getUserFriends(uid: number): Observable<{ friends: UserFriend[] }> {
    return this.http.get<{ friends: UserFriend[] }>(`${this.API_URL}/${uid}/friends`);
  }
}
