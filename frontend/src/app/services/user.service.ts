import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserSearchResult {
  uid: number;
  username: string;
  bio?: string;
  role: string;
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
}
