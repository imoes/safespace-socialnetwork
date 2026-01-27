import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="legal-container">
      <div class="legal-content">
        <h1>⚖️ Impressum</h1>
        <p class="subtitle">Angaben gemäß § 5 TMG (Telemediengesetz)</p>

        <section>
          <h2>Verantwortlich für den Inhalt</h2>
          <p>
            <strong>[Ihr Name/Firmenname]</strong><br>
            [Straße und Hausnummer]<br>
            [PLZ und Ort]<br>
            [Land]
          </p>
        </section>

        <section>
          <h2>Kontakt</h2>
          <p>
            <strong>E-Mail:</strong> [ihre-email&#64;example.com]<br>
            <strong>Telefon:</strong> [+49 123 456789]<br>
            <strong>Website:</strong> <a href="https://github.com/imoes/safespace-socialnetwork" target="_blank" rel="noopener">github.com/imoes/safespace-socialnetwork</a>
          </p>
        </section>

        <section class="optional-section">
          <h2>Registereintrag</h2>
          <p>
            <em>(Falls zutreffend - nur für Unternehmen)</em>
          </p>
          <p>
            <strong>Handelsregister:</strong> [z.B. HRB 12345]<br>
            <strong>Registergericht:</strong> [z.B. Amtsgericht München]
          </p>
        </section>

        <section class="optional-section">
          <h2>Umsatzsteuer-ID</h2>
          <p>
            <em>(Falls zutreffend - bei gewerblicher Tätigkeit)</em>
          </p>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß §27a UStG:<br>
            <strong>[DE123456789]</strong>
          </p>
        </section>

        <section>
          <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
          <p>
            <strong>[Ihr Name]</strong><br>
            [Adresse wie oben]
          </p>
        </section>

        <section>
          <h2>EU-Streitschlichtung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
          </p>
          <p>
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">
              https://ec.europa.eu/consumers/odr/
            </a>
          </p>
          <p>
            Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>
        </section>

        <section>
          <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section>
          <h2>Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
            Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
            oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </p>
          <p>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
            Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich.
            Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
          </p>
        </section>

        <section>
          <h2>Haftung für Links</h2>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
            Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
            Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>
          <p>
            Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
            Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
          </p>
        </section>

        <section>
          <h2>Urheberrecht</h2>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht.
            Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen
            der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
          <p>
            Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet.
            Insbesondere werden Inhalte Dritter als solche gekennzeichnet.
            Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis.
            Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
          </p>
        </section>

        <section>
          <h2>Open Source Software</h2>
          <p>
            Diese Plattform basiert auf Open Source Software und ist selbst unter der AGPL-3.0 Lizenz veröffentlicht.
          </p>
          <p>
            Weitere Informationen finden Sie auf unserer <a routerLink="/info">Info-Seite</a>.
          </p>
        </section>

        <div class="disclaimer">
          <p>
            <strong>Wichtiger Hinweis:</strong> Dies ist eine Vorlage und muss vor produktivem Einsatz mit Ihren tatsächlichen Daten ausgefüllt werden.
            Die mit <em>(Falls zutreffend)</em> gekennzeichneten Abschnitte können entfernt werden, wenn sie nicht zutreffen.
            Wir empfehlen dringend, einen Rechtsanwalt zu konsultieren.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .legal-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .legal-content {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    h1 {
      color: #1877f2;
      margin-bottom: 8px;
      font-size: 32px;
    }

    .subtitle {
      color: #65676b;
      font-size: 14px;
      margin-bottom: 32px;
    }

    section {
      margin-bottom: 32px;
    }

    .optional-section {
      opacity: 0.7;
      border-left: 3px solid #ffc107;
      padding-left: 16px;
    }

    h2 {
      color: #1c1e21;
      font-size: 24px;
      margin-bottom: 16px;
      margin-top: 32px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f0f2f5;
    }

    p {
      color: #1c1e21;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    a {
      color: #1877f2;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    strong {
      font-weight: 600;
      color: #1c1e21;
    }

    em {
      color: #65676b;
      font-size: 14px;
    }

    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 16px;
      margin-top: 32px;
    }

    .disclaimer p {
      margin: 0;
      color: #856404;
      font-size: 14px;
    }

    @media (max-width: 1024px) {
      .legal-content {
        padding: 24px 16px;
      }

      h1 {
        font-size: 24px;
      }

      h2 {
        font-size: 20px;
      }
    }
  `]
})
export class ImpressumComponent {}
