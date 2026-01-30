import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { UserService, UserProfile, UserFriend } from '../../services/user.service';
import { Router } from '@angular/router';
import { FriendsService } from '../../services/friends.service';
import { AuthService } from '../../services/auth.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../../services/feed.service';
import { HttpClient } from '@angular/common/http';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, PostCardComponent, TranslatePipe],
  template: `
    <div class="profile-container">
      @if (loading) {
        <div class="loading">{{ 'profile.loading' | translate }}</div>
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
                <p class="profile-realname">{{ getUsernameWithAt() }}</p>
              }
              @if (profile.bio) {
                <p class="profile-bio">{{ profile.bio }}</p>
              }
              @if (profile.birthday) {
                <p class="profile-birthday">🎂 {{ 'profile.birthday' | translate }}: {{ profile.birthday | date:'dd.MM.yyyy' }}</p>
              }
              <div class="profile-meta">
                <span class="role-badge" [class]="'role-' + profile.role">{{ getRoleLabel(profile.role) }}</span>
                <span class="joined-date">{{ 'profile.memberSince' | translate }} {{ profile.created_at | date:'dd.MM.yyyy' }}</span>
              </div>
            </div>
          </div>

          @if (!isOwnProfile) {
            <div class="profile-actions">
              <button class="btn-primary" (click)="sendFriendRequest()" [disabled]="requestSent">
                {{ requestSent ? ('✓ ' + ('profile.requestSent' | translate)) : ('👋 ' + ('profile.sendRequest' | translate)) }}
              </button>
            </div>
          }
        </div>

        @if (!isOwnProfile && isFriend) {
          <div class="personal-post-card">
            <h3 class="personal-post-title">✍️ {{ 'profile.personalPost' | translate }}</h3>
            <textarea
              [(ngModel)]="personalPostContent"
              [placeholder]="getPersonalPostPlaceholder()"
              rows="3"
              class="personal-post-textarea"
            ></textarea>
            <div class="personal-post-actions">
              <button
                class="btn-post"
                (click)="createPersonalPost()"
                [disabled]="!personalPostContent.trim() || postingPersonalPost">
                {{ postingPersonalPost ? ('profile.posting' | translate) : ('📤 ' + ('profile.leavePost' | translate)) }}
              </button>
            </div>
          </div>
        }

        <div class="profile-content-layout">
          <!-- Freunde Sidebar -->
          <aside class="friends-sidebar">
            <div class="friends-sidebar-card">
              <h3 class="friends-sidebar-title">👥 {{ 'profile.friends' | translate }}</h3>
              @if (loadingFriends) {
                <div class="friends-loading">{{ 'profile.loadingFriends' | translate }}</div>
              } @else if (userFriends().length === 0) {
                <div class="friends-empty">{{ 'profile.noFriends' | translate }}</div>
              } @else {
                <div class="friends-count">{{ userFriends().length }} {{ 'profile.friendsCount' | translate }}</div>
                <div class="friends-grid">
                  @for (friend of userFriends(); track friend.uid) {
                    <div class="friend-item" (click)="goToProfile(friend.uid)">
                      @if (friend.profile_picture) {
                        <img [src]="friend.profile_picture" [alt]="friend.username" class="friend-avatar friend-avatar-img" />
                      } @else {
                        <div class="friend-avatar">{{ friend.username.charAt(0).toUpperCase() }}</div>
                      }
                      <span class="friend-name">{{ friend.username }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </aside>

          <!-- Posts -->
          <div class="posts-section">
            <h2 class="posts-title">
              @if (isOwnProfile) {
                {{ 'profile.yourPosts' | translate }}
              } @else {
                {{ getPostsByLabel() }}
              }
            </h2>

            @if (loadingPosts) {
              <div class="loading-posts">{{ 'profile.loadingPosts' | translate }}</div>
            } @else if (posts().length === 0) {
              <div class="no-posts">
                @if (isOwnProfile) {
                  {{ 'profile.noOwnPosts' | translate }}
                } @else if (isFriend) {
                  {{ 'profile.noUserPosts' | translate }}
                } @else {
                  <div class="info-box">
                    <h3>ℹ️ {{ 'profile.hint' | translate }}</h3>
                    <p>{{ getNotFriendHint() }}</p>
                  </div>
                }
              </div>
            } @else {
              @for (post of posts(); track post.post_id) {
                <app-post-card [post]="post" (like)="onLike(post)" (unlike)="onUnlike(post)" (delete)="onPostDeleted(post)"></app-post-card>
              }
            }
          </div>
        </div>
      } @else if (error) {
        <div class="error-box">
          <h3>❌ {{ 'profile.error' | translate }}</h3>
          <p>{{ error }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .profile-container { max-width: 1100px; margin: 0 auto; padding: 20px; }
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
    .profile-birthday { margin: 0 0 12px; color: #65676b; font-size: 15px; }
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

    .personal-post-card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 20px; }
    .personal-post-title { margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #050505; }
    .personal-post-textarea { width: 100%; padding: 12px; border: 2px solid #e4e6e9; border-radius: 8px; font-family: inherit; font-size: 14px; resize: vertical; box-sizing: border-box; transition: border-color 0.2s; }
    .personal-post-textarea:focus { outline: none; border-color: #1877f2; }
    .personal-post-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
    .btn-post { padding: 10px 20px; background: #1877f2; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn-post:hover:not(:disabled) { background: #166fe5; }
    .btn-post:disabled { background: #ccc; cursor: not-allowed; }

    /* Two-column layout */
    .profile-content-layout { display: flex; gap: 20px; align-items: flex-start; }

    /* Friends Sidebar */
    .friends-sidebar { width: 280px; flex-shrink: 0; position: sticky; top: 20px; }
    .friends-sidebar-card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 20px; }
    .friends-sidebar-title { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #050505; }
    .friends-count { font-size: 13px; color: #65676b; margin-bottom: 12px; }
    .friends-loading, .friends-empty { font-size: 14px; color: #65676b; text-align: center; padding: 16px 0; }
    .friends-grid { display: flex; flex-direction: column; gap: 4px; }
    .friend-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
    .friend-item:hover { background: #f0f2f5; }
    .friend-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #1877f2, #42b72a); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; }
    .friend-avatar-img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .friend-name { font-size: 14px; font-weight: 500; color: #050505; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Posts section fills remaining space */
    .posts-section { flex: 1; min-width: 0; }
    .posts-title { font-size: 20px; font-weight: 700; color: #050505; margin-bottom: 16px; }
    .loading-posts { text-align: center; padding: 40px; color: #65676b; }
    .no-posts { text-align: center; padding: 40px; color: #65676b; }

    @media (max-width: 1024px) {
      .profile-content-layout { flex-direction: column; }
      .friends-sidebar { width: 100%; position: static; }
      .friends-grid { flex-direction: row; flex-wrap: wrap; }
      .friend-item { width: calc(50% - 2px); }
    }
  `]
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private friendsService = inject(FriendsService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private router = inject(Router);

  profile: UserProfile | null = null;
  loading = true;
  error: string | null = null;
  requestSent = false;
  isOwnProfile = false;
  isFriend = false;
  loadingPosts = true;
  loadingFriends = true;
  posts = signal<Post[]>([]);
  userFriends = signal<UserFriend[]>([]);
  personalPostContent = '';
  postingPersonalPost = false;

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
    this.loadingFriends = true;
    this.error = null;

    const currentUser = this.authService.currentUser();
    this.isOwnProfile = currentUser?.uid === uid;

    this.userService.getUserProfile(uid).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.isFriend = profile.is_friend || false;
        this.loading = false;
        this.loadPosts(uid);
        this.loadUserFriends(uid);
      },
      error: (err) => {
        this.error = this.i18n.t('errors.loadProfile');
        this.loading = false;
        this.loadingPosts = false;
        this.loadingFriends = false;
      }
    });
  }

  loadUserFriends(uid: number): void {
    this.userService.getUserFriends(uid).subscribe({
      next: (response) => {
        this.userFriends.set(response.friends);
        this.loadingFriends = false;
      },
      error: () => {
        this.loadingFriends = false;
      }
    });
  }

  goToProfile(uid: number): void {
    this.router.navigate(['/profile', uid]);
  }

  loadPosts(uid: number): void {
    this.http.get<{posts: Post[], has_more: boolean}>(`/api/users/${uid}/posts`).subscribe({
      next: (response) => {
        this.posts.set(response.posts);
        this.loadingPosts = false;
      },
      error: (err) => {
        console.error('Error loading posts:', err);
        this.loadingPosts = false;
      }
    });
  }

  onPostDeleted(post: Post): void {
    this.posts.set(this.posts().filter(p => p.post_id !== post.post_id));
  }

  onLike(post: Post): void {
    this.http.post<{liked: boolean}>(`/api/feed/${post.author_uid}/${post.post_id}/like`, {}).subscribe({
      next: (response) => {
        if (response.liked) {
          post.likes_count++;
        }
        post.is_liked_by_user = true;
      }
    });
  }

  onUnlike(post: Post): void {
    this.http.delete<{unliked: boolean}>(`/api/feed/${post.author_uid}/${post.post_id}/like`).subscribe({
      next: (response) => {
        if (response.unliked) {
          post.likes_count = Math.max(0, post.likes_count - 1);
        }
        post.is_liked_by_user = false;
      }
    });
  }

  sendFriendRequest(): void {
    if (!this.profile) return;

    this.friendsService.sendFriendRequest(this.profile.uid).subscribe({
      next: () => {
        this.requestSent = true;
        alert(this.i18n.t('profile.friendRequestSent'));
      },
      error: (err) => {
        if (err.error?.detail === 'Friend request already exists') {
          alert(this.i18n.t('errors.alreadySentRequest'));
        } else if (err.error?.detail === 'Already friends') {
          alert(this.i18n.t('errors.alreadyFriends'));
        } else {
          alert(this.i18n.t('errors.sendFriendRequest'));
        }
      }
    });
  }

  getRoleLabel(role: string): string {
    const keyMap: Record<string, string> = {
      user: 'profile.roleUser',
      moderator: 'profile.roleModerator',
      admin: 'profile.roleAdmin'
    };
    return keyMap[role] ? this.i18n.t(keyMap[role]) : role;
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

  getUsernameWithAt(): string {
    return this.profile ? `@${this.profile.username}` : '';
  }

  getPersonalPostPlaceholder(): string {
    if (!this.profile) return '';
    return this.i18n.t('profile.personalPostPlaceholder').replace('{{username}}', this.profile.username);
  }

  getPostsByLabel(): string {
    if (!this.profile) return '';
    return this.i18n.t('profile.postsBy').replace('{{username}}', this.profile.username);
  }

  getNotFriendHint(): string {
    if (!this.profile) return '';
    return this.i18n.t('profile.notFriendHint').replace('{{username}}', this.profile.username);
  }

  createPersonalPost(): void {
    if (!this.profile || !this.personalPostContent.trim()) return;

    this.postingPersonalPost = true;

    this.http.post(`/api/users/${this.profile.uid}/posts`, {
      content: this.personalPostContent,
      visibility: 'public'
    }).subscribe({
      next: () => {
        this.personalPostContent = '';
        this.postingPersonalPost = false;
        if (this.profile) {
          this.loadPosts(this.profile.uid);
        }
      },
      error: (err) => {
        console.error('Error creating personal post:', err);
        alert(this.i18n.t('errors.createPost'));
        this.postingPersonalPost = false;
      }
    });
  }
}
