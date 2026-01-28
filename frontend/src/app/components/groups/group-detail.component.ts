import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GroupsService, Group, GroupMember, GroupPost, GroupComment } from '../../services/groups.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AutoEmojiDirective } from '../../directives/auto-emoji.directive';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, AutoEmojiDirective],
  template: `
    <div class="group-detail-container">
      @if (loading()) {
        <p class="loading">{{ 'common.loading' | translate }}</p>
      } @else if (group()) {
        <!-- Group Header -->
        <div class="group-header-card">
          <div class="group-header-top">
            <a routerLink="/groups" class="back-link">← {{ 'common.back' | translate }}</a>
          </div>
          <div class="group-header-content">
            <div class="group-icon-large">{{ group()!.name.charAt(0).toUpperCase() }}</div>
            <div class="group-header-info">
              <h1>{{ group()!.name }}</h1>
              @if (group()!.description) {
                <p class="group-description">{{ group()!.description }}</p>
              }
              <div class="group-stats">
                <span>{{ group()!.member_count }} {{ 'groups.members' | translate }}</span>
                @if (group()!.my_role) {
                  <span class="role-badge" [class.role-admin]="group()!.my_role === 'admin' || group()!.my_role === 'owner'">
                    {{ group()!.my_role === 'owner' ? ('groups.owner' | translate) : group()!.my_role === 'admin' ? ('groups.admin' | translate) : ('groups.member' | translate) }}
                  </span>
                }
              </div>
            </div>
          </div>
          <div class="group-actions">
            @if (!group()!.my_role && group()!.my_status !== 'pending') {
              <button class="btn btn-primary" (click)="joinGroup()">
                {{ group()!.join_mode === 'approval' ? ('groups.requestJoin' | translate) : ('groups.join' | translate) }}
              </button>
            } @else if (group()!.my_status === 'pending') {
              <button class="btn btn-secondary" disabled>{{ 'groups.pendingRequest' | translate }}</button>
            } @else if (group()!.my_role !== 'owner') {
              <button class="btn btn-secondary" (click)="leaveGroup()">{{ 'groups.leave' | translate }}</button>
            }
            @if (group()!.my_role === 'owner' || group()!.my_role === 'admin') {
              <button class="btn btn-danger" (click)="deleteGroup()">{{ 'groups.deleteGroup' | translate }}</button>
            }
          </div>

          <!-- Join Mode Settings (Admins only) -->
          @if (isGroupAdmin()) {
            <div class="settings-row">
              <label class="setting-label">{{ 'groups.joinMode' | translate }}:</label>
              <select
                [ngModel]="group()!.join_mode || 'open'"
                (ngModelChange)="updateJoinMode($event)"
                class="visibility-select"
              >
                <option value="open">{{ 'groups.joinModeOpen' | translate }}</option>
                <option value="approval">{{ 'groups.joinModeApproval' | translate }}</option>
              </select>
            </div>
          }
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button
            class="tab"
            [class.active]="activeTab() === 'posts'"
            (click)="activeTab.set('posts')"
          >
            {{ 'groups.posts' | translate }}
          </button>
          @if (isGroupAdmin() && group()!.pending_count) {
            <button
              class="tab"
              [class.active]="activeTab() === 'pending'"
              (click)="activeTab.set('pending'); loadPendingMembers()"
            >
              {{ 'groups.pendingRequests' | translate }} ({{ group()!.pending_count }})
            </button>
          }
          <button
            class="tab"
            [class.active]="activeTab() === 'members'"
            (click)="activeTab.set('members'); loadMembers()"
          >
            {{ 'groups.members' | translate }}
          </button>
        </div>

        <!-- Posts Tab -->
        @if (activeTab() === 'posts') {
          <!-- Create Post (only members) -->
          @if (group()!.my_role) {
            <div class="create-post-card">
              <textarea
                [(ngModel)]="newPostContent"
                [placeholder]="'groups.postPlaceholder' | translate"
                class="post-textarea"
                rows="3"
                autoEmoji
              ></textarea>
              <div class="post-actions">
                <select [(ngModel)]="newPostVisibility" class="visibility-select">
                  <option value="internal">{{ 'groups.visibilityInternal' | translate }}</option>
                  <option value="public">{{ 'groups.visibilityPublic' | translate }}</option>
                </select>
                <button
                  class="btn btn-primary"
                  (click)="createPost()"
                  [disabled]="!newPostContent.trim()"
                >
                  {{ 'feed.postButton' | translate }}
                </button>
              </div>
            </div>
          }

          <!-- Posts List -->
          @if (loadingPosts()) {
            <p class="loading">{{ 'common.loading' | translate }}</p>
          } @else if (posts().length === 0) {
            <p class="empty">{{ 'groups.noPosts' | translate }}</p>
          } @else {
            @for (post of posts(); track post.post_id) {
              <div class="post-card">
                <div class="post-header">
                  <div class="post-author-avatar" (click)="goToProfile(post.author_uid)">
                    @if (post.author_profile_picture) {
                      <img [src]="post.author_profile_picture" class="avatar-img" [alt]="post.author_username" />
                    } @else {
                      {{ post.author_username.charAt(0).toUpperCase() }}
                    }
                  </div>
                  <div class="post-meta">
                    <span class="post-author" (click)="goToProfile(post.author_uid)">{{ post.author_username }}</span>
                    <span class="post-time">{{ formatTime(post.created_at) }}</span>
                  </div>
                  <span class="visibility-tag" [class.visibility-public]="post.visibility === 'public'">
                    {{ post.visibility === 'public' ? ('groups.visibilityPublic' | translate) : ('groups.visibilityInternal' | translate) }}
                  </span>
                  @if (post.author_uid === currentUid() || isGroupAdmin()) {
                    <button class="btn-icon delete-btn" (click)="deletePost(post.post_id)">🗑️</button>
                  }
                </div>
                <div class="post-content">{{ post.content }}</div>
                <div class="post-footer">
                  <button class="footer-btn" (click)="toggleLike(post)">
                    {{ post.liked ? '❤️' : '🤍' }} {{ post.likes_count }}
                  </button>
                  <button class="footer-btn" (click)="toggleComments(post)">
                    💬 {{ post.comments_count }}
                  </button>
                </div>

                <!-- Comments Section -->
                @if (expandedComments().has(post.post_id)) {
                  <div class="comments-section">
                    @if (postComments().get(post.post_id); as comments) {
                      @for (comment of comments; track comment.comment_id) {
                        <div class="comment">
                          <span class="comment-author" (click)="goToProfile(comment.user_uid)">{{ comment.username }}</span>
                          <span class="comment-text">{{ comment.content }}</span>
                          <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
                        </div>
                      }
                    }
                    <div class="add-comment">
                      <input
                        type="text"
                        [placeholder]="'post.commentPlaceholder' | translate"
                        class="comment-input"
                        [(ngModel)]="commentTexts[post.post_id]"
                        (keydown.enter)="addComment(post)"
                        autoEmoji
                      />
                      <button class="btn btn-sm" (click)="addComment(post)">{{ 'post.send' | translate }}</button>
                    </div>
                  </div>
                }
              </div>
            }
          }
        }

        <!-- Pending Tab -->
        @if (activeTab() === 'pending') {
          @if (loadingPending()) {
            <p class="loading">{{ 'common.loading' | translate }}</p>
          } @else if (pendingMembers().length === 0) {
            <p class="empty">{{ 'groups.noPendingRequests' | translate }}</p>
          } @else {
            <div class="members-list">
              @for (member of pendingMembers(); track member.user_uid) {
                <div class="member-card">
                  <div class="member-avatar" (click)="goToProfile(member.user_uid)">
                    @if (member.profile_picture) {
                      <img [src]="member.profile_picture" class="avatar-img" [alt]="member.username" />
                    } @else {
                      {{ member.username.charAt(0).toUpperCase() }}
                    }
                  </div>
                  <div class="member-info">
                    <span class="member-name" (click)="goToProfile(member.user_uid)">{{ member.username }}</span>
                    <span class="member-role pending-badge">{{ 'groups.pending' | translate }}</span>
                  </div>
                  <div class="member-actions">
                    <button class="btn btn-sm btn-primary" (click)="approveMember(member.user_uid)">
                      {{ 'groups.approve' | translate }}
                    </button>
                    <button class="btn btn-sm btn-danger-outline" (click)="rejectMember(member.user_uid)">
                      {{ 'groups.reject' | translate }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- Members Tab -->
        @if (activeTab() === 'members') {
          @if (loadingMembers()) {
            <p class="loading">{{ 'common.loading' | translate }}</p>
          } @else {
            <div class="members-list">
              @for (member of members(); track member.user_uid) {
                <div class="member-card">
                  <div class="member-avatar" (click)="goToProfile(member.user_uid)">
                    @if (member.profile_picture) {
                      <img [src]="member.profile_picture" class="avatar-img" [alt]="member.username" />
                    } @else {
                      {{ member.username.charAt(0).toUpperCase() }}
                    }
                  </div>
                  <div class="member-info">
                    <span class="member-name" (click)="goToProfile(member.user_uid)">{{ member.username }}</span>
                    <span class="member-role" [class.role-admin]="member.role === 'admin' || member.role === 'owner'">
                      {{ member.role === 'owner' ? ('groups.owner' | translate) : member.role === 'admin' ? ('groups.admin' | translate) : ('groups.member' | translate) }}
                    </span>
                  </div>
                  @if (isGroupAdmin() && member.role !== 'owner' && member.user_uid !== currentUid()) {
                    <div class="member-actions">
                      @if (member.role === 'member') {
                        <button class="btn btn-sm btn-outline" (click)="changeRole(member.user_uid, 'admin')">
                          {{ 'groups.makeAdmin' | translate }}
                        </button>
                      } @else if (member.role === 'admin') {
                        <button class="btn btn-sm btn-outline" (click)="changeRole(member.user_uid, 'member')">
                          {{ 'groups.removeAdmin' | translate }}
                        </button>
                      }
                      <button class="btn btn-sm btn-danger-outline" (click)="removeMember(member.user_uid)">
                        {{ 'groups.removeMember' | translate }}
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .group-detail-container { max-width: 800px; margin: 24px auto; padding: 0 16px; }

    .group-header-card {
      background: white; border-radius: 12px; padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px;
    }
    .group-header-top { margin-bottom: 16px; }
    .back-link { color: #1877f2; text-decoration: none; font-size: 14px; }
    .back-link:hover { text-decoration: underline; }

    .group-header-content { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
    .group-icon-large {
      width: 72px; height: 72px; border-radius: 16px;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white; display: flex; align-items: center; justify-content: center;
      font-size: 32px; font-weight: bold; flex-shrink: 0;
    }
    .group-header-info h1 { font-size: 24px; margin: 0; color: #1a1a2e; }
    .group-description { color: #65676b; margin: 4px 0 0; font-size: 14px; }
    .group-stats { display: flex; align-items: center; gap: 12px; margin-top: 8px; font-size: 13px; color: #90949c; }

    .group-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .btn { padding: 8px 18px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn-primary { background: #1877f2; color: white; }
    .btn-primary:hover { background: #166fe5; }
    .btn-primary:disabled { background: #bcc0c4; cursor: not-allowed; }
    .btn-secondary { background: #e4e6eb; color: #333; }
    .btn-secondary:hover { background: #d8dadf; }
    .btn-danger { background: #e74c3c; color: white; }
    .btn-danger:hover { background: #c0392b; }
    .btn-sm { padding: 4px 12px; font-size: 12px; }
    .btn-outline { background: transparent; border: 1px solid #1877f2; color: #1877f2; }
    .btn-outline:hover { background: #e7f3ff; }
    .btn-danger-outline { background: transparent; border: 1px solid #e74c3c; color: #e74c3c; }
    .btn-danger-outline:hover { background: #fdf0ef; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; }

    .role-badge {
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
      background: #e4e6eb; color: #65676b;
    }
    .role-admin { background: #e7f3ff; color: #1877f2; }

    /* Tabs */
    .tabs { display: flex; gap: 0; margin-bottom: 16px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .tab {
      flex: 1; padding: 14px; border: none; background: none; cursor: pointer;
      font-size: 15px; font-weight: 600; color: #65676b; transition: all 0.2s;
    }
    .tab:hover { background: #f0f2f5; }
    .tab.active { color: #1877f2; border-bottom: 3px solid #1877f2; }

    /* Create Post */
    .create-post-card {
      background: white; border-radius: 12px; padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px;
    }
    .post-textarea {
      width: 100%; border: 1px solid #ddd; border-radius: 8px;
      padding: 12px; font-size: 14px; resize: vertical; outline: none;
      font-family: inherit; box-sizing: border-box;
    }
    .post-textarea:focus { border-color: #1877f2; }
    .post-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
    .visibility-select {
      padding: 6px 12px; border: 1px solid #ddd; border-radius: 8px;
      font-size: 13px; outline: none; background: white;
    }

    /* Post Card */
    .post-card {
      background: white; border-radius: 12px; padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 12px;
    }
    .post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .post-author-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 16px; flex-shrink: 0; cursor: pointer; overflow: hidden;
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .post-meta { flex: 1; }
    .post-author { font-weight: 600; font-size: 14px; cursor: pointer; }
    .post-author:hover { text-decoration: underline; }
    .post-time { display: block; font-size: 12px; color: #90949c; }
    .visibility-tag {
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
      background: #e4e6eb; color: #65676b;
    }
    .visibility-public { background: #e7f3ff; color: #1877f2; }
    .delete-btn { margin-left: 4px; }

    .post-content { font-size: 15px; line-height: 1.5; color: #1a1a2e; margin-bottom: 12px; white-space: pre-wrap; }
    .post-footer { display: flex; gap: 16px; border-top: 1px solid #e4e6eb; padding-top: 8px; }
    .footer-btn {
      background: none; border: none; cursor: pointer; font-size: 14px;
      padding: 6px 12px; border-radius: 6px; color: #65676b; transition: background 0.2s;
    }
    .footer-btn:hover { background: #f0f2f5; }

    /* Comments */
    .comments-section { border-top: 1px solid #e4e6eb; padding-top: 10px; margin-top: 8px; }
    .comment { padding: 6px 0; font-size: 13px; }
    .comment-author { font-weight: 600; margin-right: 6px; cursor: pointer; }
    .comment-author:hover { text-decoration: underline; }
    .comment-text { color: #1a1a2e; }
    .comment-time { font-size: 11px; color: #90949c; margin-left: 8px; }
    .add-comment { display: flex; gap: 8px; margin-top: 8px; }
    .comment-input {
      flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px;
      font-size: 13px; outline: none;
    }
    .comment-input:focus { border-color: #1877f2; }

    /* Members */
    .members-list { display: flex; flex-direction: column; gap: 8px; }
    .member-card {
      display: flex; align-items: center; gap: 12px;
      background: white; border-radius: 12px; padding: 14px 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .member-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 18px; flex-shrink: 0; cursor: pointer; overflow: hidden;
    }
    .member-info { flex: 1; display: flex; align-items: center; gap: 8px; }
    .member-name { font-weight: 600; font-size: 15px; cursor: pointer; }
    .member-name:hover { text-decoration: underline; }
    .member-role { font-size: 12px; }
    .member-actions { display: flex; gap: 6px; flex-shrink: 0; }

    .settings-row {
      display: flex; align-items: center; gap: 12px; margin-top: 12px;
      padding-top: 12px; border-top: 1px solid #e4e6eb;
    }
    .setting-label { font-size: 14px; font-weight: 600; color: #333; white-space: nowrap; }
    .pending-badge { background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }

    .loading { color: #65676b; text-align: center; padding: 30px; }
    .empty { color: #65676b; text-align: center; padding: 30px; }
  `]
})
export class GroupDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private groupsService = inject(GroupsService);
  private authService = inject(AuthService);

  group = signal<Group | null>(null);
  members = signal<GroupMember[]>([]);
  posts = signal<(GroupPost & { liked?: boolean })[]>([]);
  loading = signal(true);
  loadingPosts = signal(false);
  loadingMembers = signal(false);
  activeTab = signal<'posts' | 'members' | 'pending'>('posts');
  pendingMembers = signal<GroupMember[]>([]);
  loadingPending = signal(false);

  expandedComments = signal<Set<number>>(new Set());
  postComments = signal<Map<number, GroupComment[]>>(new Map());

  newPostContent = '';
  newPostVisibility = 'internal';
  commentTexts: { [postId: number]: string } = {};

  currentUid = signal(0);

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) this.currentUid.set(user.uid);

    const groupId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadGroup(groupId);
    this.loadPosts(groupId);
  }

  isGroupAdmin(): boolean {
    const role = this.group()?.my_role;
    return role === 'admin' || role === 'owner';
  }

  loadGroup(groupId: number): void {
    this.groupsService.getGroup(groupId).subscribe({
      next: (res) => {
        this.group.set(res.group);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/groups']);
      }
    });
  }

  loadPosts(groupId?: number): void {
    const gid = groupId || this.group()?.group_id;
    if (!gid) return;
    this.loadingPosts.set(true);
    this.groupsService.getPosts(gid).subscribe({
      next: (res) => {
        this.posts.set(res.posts);
        this.loadingPosts.set(false);
      },
      error: () => this.loadingPosts.set(false)
    });
  }

  loadMembers(): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.loadingMembers.set(true);
    this.groupsService.getMembers(gid).subscribe({
      next: (res) => {
        this.members.set(res.members);
        this.loadingMembers.set(false);
      },
      error: () => this.loadingMembers.set(false)
    });
  }

  joinGroup(): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.joinGroup(gid).subscribe({
      next: () => this.loadGroup(gid),
      error: (err) => console.error('Error joining group:', err)
    });
  }

  leaveGroup(): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.leaveGroup(gid).subscribe({
      next: () => this.router.navigate(['/groups']),
      error: (err) => console.error('Error leaving group:', err)
    });
  }

  deleteGroup(): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.deleteGroup(gid).subscribe({
      next: () => this.router.navigate(['/groups']),
      error: (err) => console.error('Error deleting group:', err)
    });
  }

  createPost(): void {
    const gid = this.group()?.group_id;
    if (!gid || !this.newPostContent.trim()) return;
    this.groupsService.createPost(gid, this.newPostContent.trim(), this.newPostVisibility).subscribe({
      next: () => {
        this.newPostContent = '';
        this.loadPosts();
      },
      error: (err) => console.error('Error creating post:', err)
    });
  }

  deletePost(postId: number): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.deletePost(gid, postId).subscribe({
      next: () => this.loadPosts(),
      error: (err) => console.error('Error deleting post:', err)
    });
  }

  toggleLike(post: GroupPost & { liked?: boolean }): void {
    const gid = this.group()?.group_id;
    if (!gid) return;

    if (post.liked) {
      this.groupsService.unlikePost(gid, post.post_id).subscribe({
        next: (res) => {
          this.posts.update(posts =>
            posts.map(p => p.post_id === post.post_id
              ? { ...p, liked: false, likes_count: res.likes_count }
              : p
            )
          );
        }
      });
    } else {
      this.groupsService.likePost(gid, post.post_id).subscribe({
        next: (res) => {
          this.posts.update(posts =>
            posts.map(p => p.post_id === post.post_id
              ? { ...p, liked: true, likes_count: res.likes_count }
              : p
            )
          );
        }
      });
    }
  }

  toggleComments(post: GroupPost): void {
    const expanded = new Set(this.expandedComments());
    if (expanded.has(post.post_id)) {
      expanded.delete(post.post_id);
      this.expandedComments.set(expanded);
    } else {
      expanded.add(post.post_id);
      this.expandedComments.set(expanded);
      this.loadComments(post.post_id);
    }
  }

  loadComments(postId: number): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.getComments(gid, postId).subscribe({
      next: (res) => {
        const map = new Map(this.postComments());
        map.set(postId, res.comments);
        this.postComments.set(map);
      }
    });
  }

  addComment(post: GroupPost): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    const content = (this.commentTexts[post.post_id] || '').trim();
    if (!content) return;

    this.groupsService.addComment(gid, post.post_id, content).subscribe({
      next: () => {
        this.commentTexts[post.post_id] = '';
        this.loadComments(post.post_id);
        // Update comment count
        this.posts.update(posts =>
          posts.map(p => p.post_id === post.post_id
            ? { ...p, comments_count: p.comments_count + 1 }
            : p
          )
        );
      }
    });
  }

  changeRole(userUid: number, role: string): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.updateMemberRole(gid, userUid, role).subscribe({
      next: () => {
        this.loadMembers();
        this.loadGroup(gid);
      },
      error: (err) => console.error('Error changing role:', err)
    });
  }

  removeMember(userUid: number): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.removeMember(gid, userUid).subscribe({
      next: () => {
        this.loadMembers();
        this.loadGroup(gid);
      },
      error: (err) => console.error('Error removing member:', err)
    });
  }

  loadPendingMembers(): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.loadingPending.set(true);
    this.groupsService.getPendingMembers(gid).subscribe({
      next: (res) => {
        this.pendingMembers.set(res.pending);
        this.loadingPending.set(false);
      },
      error: () => this.loadingPending.set(false)
    });
  }

  approveMember(userUid: number): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.approveMember(gid, userUid).subscribe({
      next: () => {
        this.loadPendingMembers();
        this.loadGroup(gid);
      },
      error: (err) => console.error('Error approving member:', err)
    });
  }

  rejectMember(userUid: number): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.rejectMember(gid, userUid).subscribe({
      next: () => {
        this.loadPendingMembers();
        this.loadGroup(gid);
      },
      error: (err) => console.error('Error rejecting member:', err)
    });
  }

  updateJoinMode(mode: string): void {
    const gid = this.group()?.group_id;
    if (!gid) return;
    this.groupsService.updateGroupSettings(gid, mode).subscribe({
      next: () => {
        this.group.update(g => g ? { ...g, join_mode: mode } : g);
      },
      error: (err) => console.error('Error updating join mode:', err)
    });
  }

  goToProfile(uid: number): void {
    this.router.navigate(['/profile', uid]);
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  }
}
