import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService, UserProfile, UserFriend } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-user-friends-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="friends-list-container">
      <div class="friends-list-header">
        <button class="back-button" (click)="goBack()">← {{ 'friendsList.back' | translate }}</button>
        @if (profile) {
          <h1>{{ 'friendsList.title' | translate }} – {{ profile.username }}</h1>
        }
      </div>

      @if (accessDenied) {
        <div class="access-denied">
          <h3>🔒 {{ 'friendsList.accessDenied' | translate }}</h3>
          <p>{{ 'friendsList.accessDeniedHint' | translate }}</p>
        </div>
      } @else if (loading) {
        <div class="loading">{{ 'profile.loadingFriends' | translate }}</div>
      } @else if (friends().length === 0) {
        <div class="empty">{{ 'profile.noFriends' | translate }}</div>
      } @else {
        <div class="friends-count">{{ friends().length }} {{ 'profile.friendsCount' | translate }}</div>
        <div class="friends-grid">
          @for (friend of friends(); track friend.uid) {
            <div class="friend-card" (click)="goToProfile(friend.uid)">
              <div class="friend-avatar-wrapper">
                @if (friend.profile_picture) {
                  <img [src]="friend.profile_picture" [alt]="friend.username" class="friend-avatar-img" />
                } @else {
                  <div class="friend-avatar-placeholder">{{ friend.username.charAt(0).toUpperCase() }}</div>
                }
              </div>
              <span class="friend-username">{{ friend.username }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .friends-list-container { max-width: 800px; margin: 0 auto; padding: 20px; }

    .friends-list-header { margin-bottom: 24px; }
    .friends-list-header h1 { margin: 12px 0 0; font-size: 24px; font-weight: 700; color: #050505; }

    .back-button {
      background: none; border: none; color: #1877f2; font-size: 15px; font-weight: 600;
      cursor: pointer; padding: 8px 12px; border-radius: 6px; transition: background 0.2s;
    }
    .back-button:hover { background: #e7f3ff; }

    .loading, .empty { text-align: center; padding: 40px; color: #65676b; font-size: 15px; }

    .access-denied { background: #fff3cd; border: 1px solid #ffc107; border-radius: 12px; padding: 24px; text-align: center; }
    .access-denied h3 { margin: 0 0 8px; font-size: 18px; color: #856404; }
    .access-denied p { margin: 0; color: #856404; font-size: 14px; }

    .friends-count { font-size: 14px; color: #65676b; margin-bottom: 16px; }

    .friends-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .friend-card {
      display: flex; align-items: center; gap: 12px;
      background: white; border-radius: 10px; padding: 14px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08); cursor: pointer; transition: box-shadow 0.2s, transform 0.1s;
    }
    .friend-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.14); transform: translateY(-1px); }

    .friend-avatar-wrapper { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
    .friend-avatar-img { width: 100%; height: 100%; object-fit: cover; }
    .friend-avatar-placeholder {
      width: 100%; height: 100%;
      background: linear-gradient(135deg, #1877f2, #42b72a); color: white;
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 18px;
    }

    .friend-username { font-size: 15px; font-weight: 600; color: #050505; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    @media (max-width: 600px) {
      .friends-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class UserFriendsListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private userService = inject(UserService);

  profile: UserProfile | null = null;
  loading = true;
  accessDenied = false;
  friends = signal<UserFriend[]>([]);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const uid = +params['uid'];
      if (uid) {
        this.loadData(uid);
      }
    });
  }

  private loadData(uid: number): void {
    this.loading = true;
    this.accessDenied = false;

    this.userService.getUserProfile(uid).subscribe({
      next: (profile) => { this.profile = profile; },
      error: () => {}
    });

    this.userService.getUserFriends(uid).subscribe({
      next: (response) => {
        this.friends.set(response.friends);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 403) {
          this.accessDenied = true;
        }
      }
    });
  }

  goToProfile(uid: number): void {
    this.router.navigate(['/profile', uid]);
  }

  goBack(): void {
    if (this.profile) {
      this.router.navigate(['/profile', this.profile.uid]);
    } else {
      window.history.back();
    }
  }
}
