import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { authInterceptor } from './interceptors/auth.interceptor';
import { authGuard } from './guards/auth.guard';

import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { FeedComponent } from './components/feed/feed.component';
import { AdminDashboardComponent } from './components/admin/admin-dashboard.component';
import { AdminPanelComponent } from './components/admin-panel/admin-panel.component';
import { SettingsComponent } from './components/settings/settings.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { FriendsComponent } from './components/friends/friends.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { HashtagsComponent } from './components/hashtags/hashtags.component';
import { HashtagDetailComponent } from './components/hashtags/hashtag-detail.component';
import { MyPostsComponent } from './components/my-posts/my-posts.component';
import { PublicFeedComponent } from './components/public-feed/public-feed.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard] },
  { path: 'admin-panel', component: AdminPanelComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'users', component: UserManagementComponent, canActivate: [authGuard] },
  { path: 'friends', component: FriendsComponent, canActivate: [authGuard] },
  { path: 'my-posts', component: MyPostsComponent, canActivate: [authGuard] },
  { path: 'public-feed', component: PublicFeedComponent, canActivate: [authGuard] },
  { path: 'profile/:uid', component: UserProfileComponent, canActivate: [authGuard] },
  { path: 'hashtags', component: HashtagsComponent, canActivate: [authGuard] },
  { path: 'hashtag/:hashtag', component: HashtagDetailComponent, canActivate: [authGuard] },
  { path: '', component: FeedComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
