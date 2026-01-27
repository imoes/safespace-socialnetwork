import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GroupsService, Group } from '../../services/groups.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="groups-container">
      <div class="groups-header">
        <h1>{{ 'groups.title' | translate }}</h1>
        <p class="subtitle">{{ 'groups.subtitle' | translate }}</p>
      </div>

      <!-- Create Group -->
      <div class="create-group-card">
        <h3>{{ 'groups.createGroup' | translate }}</h3>
        <div class="create-form">
          <input
            type="text"
            [(ngModel)]="newGroupName"
            [placeholder]="'groups.namePlaceholder' | translate"
            class="input"
          />
          <input
            type="text"
            [(ngModel)]="newGroupDescription"
            [placeholder]="'groups.descriptionPlaceholder' | translate"
            class="input"
          />
          <div class="join-mode-row">
            <label class="join-mode-label">{{ 'groups.joinMode' | translate }}:</label>
            <select [(ngModel)]="newGroupJoinMode" class="join-mode-select">
              <option value="open">{{ 'groups.joinModeOpen' | translate }}</option>
              <option value="approval">{{ 'groups.joinModeApproval' | translate }}</option>
            </select>
          </div>
          <button
            class="btn btn-primary"
            (click)="createGroup()"
            [disabled]="!newGroupName.trim()"
          >
            {{ 'groups.create' | translate }}
          </button>
        </div>
      </div>

      <!-- My Groups -->
      <div class="section">
        <h2>{{ 'groups.myGroups' | translate }}</h2>
        @if (loadingMyGroups()) {
          <p class="loading">{{ 'common.loading' | translate }}</p>
        } @else if (myGroups().length === 0) {
          <p class="empty">{{ 'groups.noGroups' | translate }}</p>
        } @else {
          <div class="groups-grid">
            @for (group of myGroups(); track group.group_id) {
              <div class="group-card" (click)="goToGroup(group.group_id)">
                <div class="group-icon">{{ group.name.charAt(0).toUpperCase() }}</div>
                <div class="group-info">
                  <div class="group-name">{{ group.name }}</div>
                  @if (group.description) {
                    <div class="group-desc">{{ group.description }}</div>
                  }
                  <div class="group-meta">
                    {{ group.member_count }} {{ 'groups.members' | translate }}
                    @if (group.my_status === 'pending') {
                      <span class="role-badge pending-badge">{{ 'groups.pending' | translate }}</span>
                    } @else if (group.my_role) {
                      <span class="role-badge" [class.role-admin]="group.my_role === 'admin' || group.my_role === 'owner'">
                        {{ group.my_role === 'owner' ? ('groups.owner' | translate) : group.my_role === 'admin' ? ('groups.admin' | translate) : ('groups.member' | translate) }}
                      </span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Search Groups -->
      <div class="section">
        <h2>{{ 'groups.searchGroups' | translate }}</h2>
        <div class="search-bar">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            [placeholder]="'groups.searchPlaceholder' | translate"
            class="input search-input"
            (input)="onSearchInput()"
          />
        </div>
        @if (loadingSearch()) {
          <p class="loading">{{ 'common.loading' | translate }}</p>
        } @else if (searchQuery.length >= 2 && searchResults().length === 0) {
          <p class="empty">{{ 'common.noResults' | translate }}</p>
        } @else if (searchResults().length > 0) {
          <div class="groups-grid">
            @for (group of searchResults(); track group.group_id) {
              <div class="group-card" (click)="goToGroup(group.group_id)">
                <div class="group-icon">{{ group.name.charAt(0).toUpperCase() }}</div>
                <div class="group-info">
                  <div class="group-name">{{ group.name }}</div>
                  @if (group.description) {
                    <div class="group-desc">{{ group.description }}</div>
                  }
                  <div class="group-meta">
                    {{ group.member_count }} {{ 'groups.members' | translate }}
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .groups-container { max-width: 800px; margin: 24px auto; padding: 0 16px; }
    .groups-header { margin-bottom: 24px; }
    .groups-header h1 { font-size: 28px; font-weight: 700; color: #1a1a2e; margin: 0; }
    .subtitle { color: #65676b; margin-top: 4px; }

    .create-group-card {
      background: white; border-radius: 12px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px;
    }
    .create-group-card h3 { margin: 0 0 12px; font-size: 16px; color: #333; }
    .create-form { display: flex; flex-direction: column; gap: 10px; }
    .input {
      padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px;
      font-size: 14px; outline: none; width: 100%; box-sizing: border-box;
    }
    .input:focus { border-color: #1877f2; }

    .btn {
      padding: 10px 20px; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s;
    }
    .btn-primary { background: #1877f2; color: white; }
    .btn-primary:hover { background: #166fe5; }
    .btn-primary:disabled { background: #bcc0c4; cursor: not-allowed; }

    .section { margin-bottom: 32px; }
    .section h2 { font-size: 20px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px; }

    .search-bar { margin-bottom: 16px; }
    .search-input { max-width: 400px; }

    .groups-grid { display: flex; flex-direction: column; gap: 12px; }
    .group-card {
      display: flex; align-items: center; gap: 16px;
      background: white; border-radius: 12px; padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;
      transition: box-shadow 0.2s, transform 0.1s;
    }
    .group-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.15); transform: translateY(-1px); }

    .group-icon {
      width: 50px; height: 50px; border-radius: 12px;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white; display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: bold; flex-shrink: 0;
    }
    .group-info { flex: 1; min-width: 0; }
    .group-name { font-weight: 600; font-size: 16px; color: #1a1a2e; }
    .group-desc { font-size: 13px; color: #65676b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .group-meta { font-size: 12px; color: #90949c; margin-top: 4px; display: flex; align-items: center; gap: 8px; }

    .role-badge {
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
      background: #e4e6eb; color: #65676b;
    }
    .role-admin { background: #e7f3ff; color: #1877f2; }
    .pending-badge { background: #fff3cd; color: #856404; }

    .join-mode-row { display: flex; align-items: center; gap: 10px; }
    .join-mode-label { font-size: 14px; font-weight: 600; color: #333; white-space: nowrap; }
    .join-mode-select {
      padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px;
      font-size: 14px; outline: none; background: white; flex: 1;
    }

    .loading { color: #65676b; text-align: center; padding: 20px; }
    .empty { color: #65676b; text-align: center; padding: 20px; }
  `]
})
export class GroupsComponent implements OnInit {
  private groupsService = inject(GroupsService);
  private router = inject(Router);

  myGroups = signal<Group[]>([]);
  searchResults = signal<Group[]>([]);
  loadingMyGroups = signal(false);
  loadingSearch = signal(false);

  newGroupName = '';
  newGroupDescription = '';
  newGroupJoinMode = 'open';
  searchQuery = '';
  private searchTimeout: any;

  ngOnInit(): void {
    this.loadMyGroups();
  }

  loadMyGroups(): void {
    this.loadingMyGroups.set(true);
    this.groupsService.getMyGroups().subscribe({
      next: (res) => {
        this.myGroups.set(res.groups);
        this.loadingMyGroups.set(false);
      },
      error: () => this.loadingMyGroups.set(false)
    });
  }

  createGroup(): void {
    const name = this.newGroupName.trim();
    if (!name) return;

    this.groupsService.createGroup(name, this.newGroupDescription.trim() || undefined, this.newGroupJoinMode).subscribe({
      next: (res) => {
        this.newGroupName = '';
        this.newGroupDescription = '';
        this.newGroupJoinMode = 'open';
        this.loadMyGroups();
        this.router.navigate(['/groups', res.group.group_id]);
      },
      error: (err) => console.error('Error creating group:', err)
    });
  }

  onSearchInput(): void {
    clearTimeout(this.searchTimeout);
    if (this.searchQuery.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimeout = setTimeout(() => {
      this.loadingSearch.set(true);
      this.groupsService.getGroups(this.searchQuery).subscribe({
        next: (res) => {
          this.searchResults.set(res.groups);
          this.loadingSearch.set(false);
        },
        error: () => this.loadingSearch.set(false)
      });
    }, 300);
  }

  goToGroup(groupId: number): void {
    this.router.navigate(['/groups', groupId]);
  }
}
