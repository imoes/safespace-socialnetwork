import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

interface SeoConfig {
  title: string;
  description: string;
}

const ROUTE_SEO: Record<string, SeoConfig> = {
  '/login': {
    title: 'Anmelden – SafeSpace',
    description: 'Melde dich bei SafeSpace an – deinem sicheren, werbefreien Social Network aus Europa.'
  },
  '/register': {
    title: 'Registrieren – SafeSpace',
    description: 'Erstelle jetzt dein kostenloses SafeSpace-Konto. Sicher, werbefrei und Open Source.'
  },
  '/public-feed': {
    title: 'Öffentlicher Feed – SafeSpace',
    description: 'Entdecke öffentliche Beiträge auf SafeSpace – ohne Algorithmen, chronologisch sortiert.'
  },
  '/privacy-policy': {
    title: 'Datenschutzerklärung – SafeSpace',
    description: 'Datenschutzerklärung von SafeSpace. Deine Daten gehören dir und bleiben in Europa.'
  },
  '/terms': {
    title: 'Nutzungsbedingungen – SafeSpace',
    description: 'Nutzungsbedingungen von SafeSpace. Transparent und fair.'
  },
  '/impressum': {
    title: 'Impressum – SafeSpace',
    description: 'Impressum und rechtliche Informationen zu SafeSpace.'
  },
  '/info': {
    title: 'Über uns – SafeSpace',
    description: 'Erfahre mehr über SafeSpace – ein sicheres Social Network, gebaut von der Community für die Community.'
  },
  '/friends': {
    title: 'Freunde – SafeSpace',
    description: 'Verwalte deine Freundschaften auf SafeSpace.'
  },
  '/groups': {
    title: 'Gruppen – SafeSpace',
    description: 'Entdecke und erstelle Gruppen auf SafeSpace.'
  },
  '/hashtags': {
    title: 'Hashtags – SafeSpace',
    description: 'Trending Hashtags und Themen auf SafeSpace.'
  },
  '/settings': {
    title: 'Einstellungen – SafeSpace',
    description: 'Passe dein SafeSpace-Profil und deine Einstellungen an.'
  },
  '/my-posts': {
    title: 'Meine Beiträge – SafeSpace',
    description: 'Deine Beiträge auf SafeSpace.'
  },
  '/': {
    title: 'Feed – SafeSpace',
    description: 'Dein persönlicher Feed auf SafeSpace – Beiträge deiner Freunde, chronologisch sortiert.'
  }
};

const DEFAULT_SEO: SeoConfig = {
  title: 'SafeSpace – Dein sicheres Social Network',
  description: 'SafeSpace ist ein sicheres, werbefreies Social Network aus Europa. Ohne Algorithmen, ohne Überwachung – deine Daten gehören dir.'
};

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private titleService = inject(Title);
  private meta = inject(Meta);
  private router = inject(Router);

  init(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects.split('?')[0];
      const config = ROUTE_SEO[url] || DEFAULT_SEO;

      this.titleService.setTitle(config.title);
      this.meta.updateTag({ name: 'description', content: config.description });
      this.meta.updateTag({ property: 'og:title', content: config.title });
      this.meta.updateTag({ property: 'og:description', content: config.description });
      this.meta.updateTag({ property: 'og:url', content: `https://thesafespace.blog${url}` });

      // Update canonical URL
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (link) {
        link.href = `https://thesafespace.blog${url === '/' ? '' : url}`;
      }
    });
  }
}
