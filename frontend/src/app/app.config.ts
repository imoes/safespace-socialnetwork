import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { authInterceptor } from './interceptors/auth.interceptor';
import { authGuard } from './guards/auth.guard';
import { I18nService } from './services/i18n.service';

// Factory function for APP_INITIALIZER
function initializeI18n(): () => Promise<void> {
  const i18nService = inject(I18nService);
  return () => i18nService.initialize();
}

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
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';
import { ImpressumComponent } from './components/impressum/impressum.component';
import { TermsOfServiceComponent } from './components/terms-of-service/terms-of-service.component';
import { CommunityGuidelinesComponent } from './components/community-guidelines/community-guidelines.component';
import { InfoComponent } from './components/info/info.component';
import { GroupsComponent } from './components/groups/groups.component';
import { GroupDetailComponent } from './components/groups/group-detail.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { UserFriendsListComponent } from './components/user-friends-list/user-friends-list.component';
import { ParentalConsentComponent } from './components/parental-consent/parental-consent.component';
import { EmailVerificationComponent } from './components/email-verification/email-verification.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'parental-consent/:token', component: ParentalConsentComponent },
  { path: 'verify-email/:token', component: EmailVerificationComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard] },
  { path: 'admin-panel', component: AdminPanelComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'users', component: UserManagementComponent, canActivate: [authGuard] },
  { path: 'friends', component: FriendsComponent, canActivate: [authGuard] },
  { path: 'my-posts', component: MyPostsComponent, canActivate: [authGuard] },
  { path: 'public-feed', component: PublicFeedComponent, canActivate: [authGuard] },
  { path: 'profile/:uid/friends', component: UserFriendsListComponent, canActivate: [authGuard] },
  { path: 'profile/:uid', component: UserProfileComponent, canActivate: [authGuard] },
  { path: 'hashtags', component: HashtagsComponent, canActivate: [authGuard] },
  { path: 'hashtag/:hashtag', component: HashtagDetailComponent, canActivate: [authGuard] },
  { path: 'groups', component: GroupsComponent, canActivate: [authGuard] },
  { path: 'groups/:id', component: GroupDetailComponent, canActivate: [authGuard] },
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'impressum', component: ImpressumComponent },
  { path: 'terms', component: TermsOfServiceComponent },
  { path: 'community-guidelines', component: CommunityGuidelinesComponent },
  { path: 'info', component: InfoComponent, canActivate: [authGuard] },
  { path: '', component: FeedComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Initialize i18n service before app starts to ensure translations are loaded
    {
      provide: APP_INITIALIZER,
      useFactory: initializeI18n,
      multi: true
    }
  ]
};
