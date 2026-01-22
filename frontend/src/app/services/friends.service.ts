import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface Friend {
  uid: number;
  username: string;
  created_at: string;
}

export interface FriendRequest {
  uid: number;
  username: string;
  requested_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class FriendsService {
  private readonly API_URL = '/api/friends';

  // Signals
  private friendsSignal = signal<Friend[]>([]);
  private onlineFriendsSignal = signal<Friend[]>([]);
  private pendingRequestsSignal = signal<FriendRequest[]>([]);
  private isLoadingSignal = signal(false);

  // Computed
  readonly friends = computed(() => this.friendsSignal());
  readonly onlineFriends = computed(() => this.onlineFriendsSignal());
  readonly pendingRequests = computed(() => this.pendingRequestsSignal());
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly friendCount = computed(() => this.friendsSignal().length);
  readonly onlineCount = computed(() => this.onlineFriendsSignal().length);

  constructor(private http: HttpClient) {}

  /**
   * Lädt alle Freunde
   */
  loadFriends(): void {
    this.isLoadingSignal.set(true);
    
    this.http.get<Friend[]>(this.API_URL).subscribe({
      next: (friends) => {
        this.friendsSignal.set(friends);
        this.isLoadingSignal.set(false);
      },
      error: () => this.isLoadingSignal.set(false)
    });
  }

  /**
   * Lädt online Freunde
   */
  loadOnlineFriends(): void {
    this.http.get<Friend[]>(`${this.API_URL}/online`).subscribe({
      next: (friends) => this.onlineFriendsSignal.set(friends)
    });
  }

  /**
   * Lädt ausstehende Freundschaftsanfragen
   */
  loadPendingRequests(): void {
    this.http.get<{ requests: FriendRequest[] }>(`${this.API_URL}/requests`).subscribe({
      next: (response) => this.pendingRequestsSignal.set(response.requests)
    });
  }

  /**
   * Sendet Freundschaftsanfrage
   */
  sendFriendRequest(targetUid: number): Observable<any> {
    return this.http.post(`${this.API_URL}/request`, { target_uid: targetUid });
  }

  /**
   * Akzeptiert Freundschaftsanfrage
   */
  acceptRequest(requesterUid: number): Observable<any> {
    return this.http.post(`${this.API_URL}/accept/${requesterUid}`, {}).pipe(
      tap(() => {
        // Request aus Liste entfernen
        this.pendingRequestsSignal.update(requests =>
          requests.filter(r => r.uid !== requesterUid)
        );
        // Freundesliste neu laden
        this.loadFriends();
      })
    );
  }

  /**
   * Entfernt Freund
   */
  removeFriend(friendUid: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${friendUid}`).pipe(
      tap(() => {
        this.friendsSignal.update(friends =>
          friends.filter(f => f.uid !== friendUid)
        );
      })
    );
  }
}
