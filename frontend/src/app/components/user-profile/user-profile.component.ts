import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { UserService, UserProfile } from '../../services/user.service';
import { FriendsService } from '../../services/friends.service';
import { AuthService } from '../../services/auth.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../../services/feed.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, PostCardComponent],
  template: `
    <div class="profile-container">
      @if (loading) {
        <div class="loading">Profil wird geladen...</div>
      } @else if (profile) {
        <div class="profile-card">
          <div class="profile-header">
            <div class="profile-avatar">
              @if (profile.profile_picture) {
                <img [src]="profile.profile_picture" alt="Profilbild" />
              } @else {
                <div class="avatar-placeholder">{{ profile.username.charAt(0).toUpperCase() }}</div>
              }
            </div>
            <div class="profile-info">
              <h1 class="profile-username">{{ getDisplayName() }}</h1>
              @if (profile.first_name || profile.last_name) {
                <p class="profile-realname">@{{ profile.username }}</p>
              }
              @if (profile.bio) {
                <p class="profile-bio">{{ profile.bio }}</p>
              }
              <div class="profile-meta">
                <span class="role-badge" [class]="'role-' + profile.role">{{ getRoleLabel(profile.role) }}</span>
                <span class="joined-date">Mitglied seit {{ profile.created_at | date:'dd.MM.yyyy' }}</span>
              </div>
            </div>
          </div>

          @if (!isOwnProfile) {
            <div class="profile-actions">
              <button class="btn-primary" (click)="sendFriendRequest()" [disabled]="requestSent">
                {{ requestSent ? '✓ Anfrage gesendet' : '👋 Freundschaftsanfrage senden' }}
              </button>
            </div>
          }
        </div>

        <div class="posts-section">
          <h2 class="posts-title">
            @if (isOwnProfile) {
              Deine Posts
            } @else {
              Posts von {{ profile.username }}
            }
          </h2>

          @if (loadingPosts) {
            <div class="loading-posts">Posts werden geladen...</div>
          } @else if (posts().length === 0) {
            <div class="no-posts">
              @if (isOwnProfile) {
                Du hast noch keine Posts erstellt.
              } @else if (isFriend) {
                Dieser Benutzer hat noch keine Posts erstellt.
              } @else {
                <div class="info-box">
                  <h3>ℹ️ Hinweis</h3>
                  <p>Posts von Benutzern können nur von Freunden gesehen werden. Füge {{ profile.username }} als Freund hinzu, um mehr Posts zu sehen!</p>
                </div>
              }
            </div>
          } @else {
            @for (post of posts(); track post.post_id) {
              <app-post-card [post]="post" (delete)="onPostDeleted(post)"></app-post-card>
            }
          }
        </div>
      } @else if (error) {
        <div class="error-box">
          <h3>❌ Fehler</h3>
          <p>{{ error }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .profile-container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .loading { text-align: center; padding: 40px; color: #65676b; }

    .profile-card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 32px; margin-bottom: 20px; }
    .profile-header { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 24px; }

    .profile-avatar { width: 120px; height: 120px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
    .profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #1877f2, #42b72a); color: white; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold; }

    .profile-info { flex: 1; min-width: 0; }
    .profile-username { margin: 0 0 4px; font-size: 28px; font-weight: 700; color: #050505; }
    .profile-realname { margin: 0 0 8px; font-size: 15px; color: #65676b; font-weight: 400; }
    .profile-bio { margin: 0 0 16px; color: #65676b; line-height: 1.5; }
    .profile-meta { display: flex; gap: 16px; align-items: center; }

    .role-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .role-user { background: #e4e6e9; color: #65676b; }
    .role-moderator { background: #fff3cd; color: #856404; }
    .role-admin { background: #f8d7da; color: #721c24; }
    .joined-date { font-size: 13px; color: #65676b; }

    .profile-actions { display: flex; gap: 12px; }
    .btn-primary { padding: 12px 24px; background: #1877f2; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn-primary:hover:not(:disabled) { background: #166fe5; }
    .btn-primary:disabled { background: #ccc; cursor: not-allowed; }

    .info-box { background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 12px; padding: 20px; }
    .info-box h3 { margin: 0 0 12px; color: #1877f2; font-size: 18px; }
    .info-box p { margin: 0; color: #1c1e21; line-height: 1.5; }

    .error-box { background: #ffe7e7; border: 1px solid #ffb3b3; border-radius: 12px; padding: 20px; }
    .error-box h3 { margin: 0 0 12px; color: #d32f2f; font-size: 18px; }
    .error-box p { margin: 0; color: #1c1e21; }

    .posts-section { margin-top: 20px; }
    .posts-title { font-size: 20px; font-weight: 700; color: #050505; margin-bottom: 16px; }
    .loading-posts { text-align: center; padding: 40px; color: #65676b; }
    .no-posts { text-align: center; padding: 40px; color: #65676b; }
  `]
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private friendsService = inject(FriendsService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  profile: UserProfile | null = null;
  loading = true;
  error: string | null = null;
  requestSent = false;
  isOwnProfile = false;
  isFriend = false;
  loadingPosts = true;
  posts = signal<Post[]>([]);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const uid = +params['uid'];
      if (uid) {
        this.loadProfile(uid);
      }
    });
  }

  loadProfile(uid: number): void {
    this.loading = true;
    this.loadingPosts = true;
    this.error = null;

    const currentUser = this.authService.currentUser();
    this.isOwnProfile = currentUser?.uid === uid;

    // Profil laden
    this.userService.getUserProfile(uid).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
        // Posts laden
        this.loadPosts(uid);
      },
      error: (err) => {
        this.error = 'Profil konnte nicht geladen werden.';
        this.loading = false;
        this.loadingPosts = false;
      }
    });
  }

  loadPosts(uid: number): void {
    this.http.get<{posts: Post[], has_more: boolean}>(`/api/users/${uid}/posts`).subscribe({
      next: (response) => {
        this.posts.set(response.posts);
        this.isFriend = response.posts.length > 0 || this.isOwnProfile;
        this.loadingPosts = false;
      },
      error: (err) => {
        console.error('Fehler beim Laden der Posts:', err);
        this.loadingPosts = false;
      }
    });
  }

  onPostDeleted(post: Post): void {
    this.posts.set(this.posts().filter(p => p.post_id !== post.post_id));
  }

  sendFriendRequest(): void {
    if (!this.profile) return;

    this.friendsService.sendFriendRequest(this.profile.uid).subscribe({
      next: () => {
        this.requestSent = true;
        alert('Freundschaftsanfrage wurde gesendet!');
      },
      error: (err) => {
        if (err.error?.detail === 'Friend request already exists') {
          alert('Du hast bereits eine Freundschaftsanfrage an diesen Benutzer gesendet.');
        } else if (err.error?.detail === 'Already friends') {
          alert('Ihr seid bereits befreundet!');
        } else {
          alert('Fehler beim Senden der Freundschaftsanfrage.');
        }
      }
    });
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      user: 'Benutzer',
      moderator: 'Moderator',
      admin: 'Administrator'
    };
    return labels[role] || role;
  }

  getDisplayName(): string {
    if (!this.profile) return '';

    const firstName = this.profile.first_name?.trim();
    const lastName = this.profile.last_name?.trim();

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    }

    return this.profile.username;
  }
}
