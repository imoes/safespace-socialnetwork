import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from app.config import settings
from app.db.site_settings import get_site_url


class EmailService:
    """
    Service für das Versenden von E-Mails über SMTP.
    Konfiguriert über Umgebungsvariablen in docker-compose.yml.
    """

    # Mehrsprachige E-Mail-Strings
    _EMAIL_STRINGS = {
        "de": {
            "greeting": "Hallo {username},",
            "greeting_html": "Hallo <strong>{username}</strong>,",
            "closing": "Viele Grüße,",
            "team": "Dein SafeSpace Team",
            "your_post": "Dein Post",
            "comment_by": "Kommentar von {actor}",
            "view_post": "Post ansehen",
            "view_comment": "Kommentar ansehen",
            "view_profile": "Profil ansehen",
            "view_group": "Gruppe ansehen",
            "review_request": "Anfrage überprüfen",
            "new_notification": "Neue Benachrichtigung",
            "new_comment": "Neuer Kommentar",
            "years": "Jahre",
            "a_group": "einer Gruppe",
            "footer_reason": "Du erhältst diese E-Mail, weil du Benachrichtigungen aktiviert hast. Du kannst diese in deinen Einstellungen deaktivieren.",
            "footer_tagline": "Dein sicheres Social Network",
            # post_liked
            "post_liked_subject": "{actor} hat deinen Post geliked!",
            "post_liked_body": "{actor} hat einen deiner Posts geliked!",
            "post_liked_body_html": "<strong>{actor}</strong> hat einen deiner Posts geliked!",
            # post_commented
            "post_commented_subject": "{actor} hat deinen Post kommentiert!",
            "post_commented_body": "{actor} hat deinen Post kommentiert!",
            "post_commented_body_html": "<strong>{actor}</strong> hat deinen Post kommentiert!",
            # comment_liked
            "comment_liked_subject": "{actor} hat deinen Kommentar geliked!",
            "comment_liked_body": "{actor} hat deinen Kommentar geliked!",
            "comment_liked_body_html": "<strong>{actor}</strong> hat deinen Kommentar geliked!",
            "comment_liked_header": "Kommentar geliked",
            # birthday
            "birthday_subject": "{actor} hat heute Geburtstag!",
            "birthday_body": "{actor} hat heute Geburtstag!",
            "birthday_body_html": "<strong>{actor}</strong> hat heute Geburtstag!",
            "birthday_header": "Geburtstag!",
            "birthday_age_text": "und ist heute {age} Jahre alt geworden",
            "birthday_cta": "Gratuliere jetzt auf SafeSpace!",
            # group_join_request
            "group_join_subject": "{actor} möchte deiner Gruppe beitreten!",
            "group_join_body": "{actor} möchte der Gruppe \"{group}\" beitreten.",
            "group_join_body_html": "<strong>{actor}</strong> möchte der Gruppe <strong>\"{group}\"</strong> beitreten.",
            "group_join_header": "Neue Beitrittsanfrage",
            "group_join_review": "Bitte überprüfe die Anfrage und entscheide, ob du sie annehmen oder ablehnen möchtest.",
            # friend_request
            "friend_request_subject": "{actor} möchte mit dir befreundet sein!",
            "friend_request_body": "{actor} hat dir eine Freundschaftsanfrage gesendet!",
            "friend_request_body_html": "<strong>{actor}</strong> hat dir eine Freundschaftsanfrage gesendet!",
            "friend_request_header": "Neue Freundschaftsanfrage",
            # friend_request_accepted
            "friend_accepted_subject": "{actor} hat deine Freundschaftsanfrage angenommen!",
            "friend_accepted_body": "{actor} hat deine Freundschaftsanfrage angenommen! Ihr seid jetzt Freunde.",
            "friend_accepted_body_html": "<strong>{actor}</strong> hat deine Freundschaftsanfrage angenommen! Ihr seid jetzt Freunde.",
            "friend_accepted_header": "Freundschaftsanfrage angenommen",
            # post_shared
            "post_shared_subject": "{actor} hat einen Post mit dir geteilt!",
            "post_shared_body": "{actor} hat einen Post mit dir geteilt!",
            "post_shared_body_html": "<strong>{actor}</strong> hat einen Post mit dir geteilt!",
            "post_shared_header": "Post geteilt",
            # welcome
            "welcome_subject": "Willkommen bei SafeSpace, {username}!",
            "welcome_body": "Willkommen bei SafeSpace! Wir freuen uns, dass du dabei bist.",
            "welcome_desc": "Entdecke deine Timeline, finde Freunde und teile deine Gedanken. SafeSpace ist dein Raum — sicher, respektvoll und einladend.",
            "welcome_header": "Willkommen bei SafeSpace!",
            "welcome_cta": "Jetzt loslegen",
            # default
            "default_subject": "Neue Benachrichtigung von {actor}",
            "default_body": "Du hast eine neue Benachrichtigung erhalten.",
            "default_header": "Neue Benachrichtigung",
        },
        "en": {
            "greeting": "Hello {username},",
            "greeting_html": "Hello <strong>{username}</strong>,",
            "closing": "Best regards,",
            "team": "Your SafeSpace Team",
            "your_post": "Your post",
            "comment_by": "Comment by {actor}",
            "view_post": "View post",
            "view_comment": "View comment",
            "view_profile": "View profile",
            "view_group": "View group",
            "review_request": "Review request",
            "new_notification": "New notification",
            "new_comment": "New comment",
            "years": "years",
            "a_group": "a group",
            "footer_reason": "You are receiving this email because you have notifications enabled. You can disable them in your settings.",
            "footer_tagline": "Your safe social network",
            "post_liked_subject": "{actor} liked your post!",
            "post_liked_body": "{actor} liked one of your posts!",
            "post_liked_body_html": "<strong>{actor}</strong> liked one of your posts!",
            "post_commented_subject": "{actor} commented on your post!",
            "post_commented_body": "{actor} commented on your post!",
            "post_commented_body_html": "<strong>{actor}</strong> commented on your post!",
            "comment_liked_subject": "{actor} liked your comment!",
            "comment_liked_body": "{actor} liked your comment!",
            "comment_liked_body_html": "<strong>{actor}</strong> liked your comment!",
            "comment_liked_header": "Comment liked",
            "birthday_subject": "{actor} has a birthday today!",
            "birthday_body": "{actor} has a birthday today!",
            "birthday_body_html": "<strong>{actor}</strong> has a birthday today!",
            "birthday_header": "Birthday!",
            "birthday_age_text": "and is turning {age} today",
            "birthday_cta": "Send your congratulations on SafeSpace!",
            "group_join_subject": "{actor} wants to join your group!",
            "group_join_body": "{actor} wants to join the group \"{group}\".",
            "group_join_body_html": "<strong>{actor}</strong> wants to join the group <strong>\"{group}\"</strong>.",
            "group_join_header": "New join request",
            "group_join_review": "Please review the request and decide whether to accept or decline.",
            "friend_request_subject": "{actor} wants to be your friend!",
            "friend_request_body": "{actor} sent you a friend request!",
            "friend_request_body_html": "<strong>{actor}</strong> sent you a friend request!",
            "friend_request_header": "New friend request",
            "friend_accepted_subject": "{actor} accepted your friend request!",
            "friend_accepted_body": "{actor} accepted your friend request! You are now friends.",
            "friend_accepted_body_html": "<strong>{actor}</strong> accepted your friend request! You are now friends.",
            "friend_accepted_header": "Friend request accepted",
            "post_shared_subject": "{actor} shared a post with you!",
            "post_shared_body": "{actor} shared a post with you!",
            "post_shared_body_html": "<strong>{actor}</strong> shared a post with you!",
            "post_shared_header": "Post shared",
            "welcome_subject": "Welcome to SafeSpace, {username}!",
            "welcome_body": "Welcome to SafeSpace! We are glad to have you.",
            "welcome_desc": "Discover your timeline, find friends and share your thoughts. SafeSpace is your space — safe, respectful and welcoming.",
            "welcome_header": "Welcome to SafeSpace!",
            "welcome_cta": "Get started",
            "default_subject": "New notification from {actor}",
            "default_body": "You have received a new notification.",
            "default_header": "New notification",
        },
        "fr": {
            "greeting": "Bonjour {username},",
            "greeting_html": "Bonjour <strong>{username}</strong>,",
            "closing": "Cordialement,",
            "team": "Votre équipe SafeSpace",
            "your_post": "Votre publication",
            "comment_by": "Commentaire de {actor}",
            "view_post": "Voir la publication",
            "view_comment": "Voir le commentaire",
            "view_profile": "Voir le profil",
            "view_group": "Voir le groupe",
            "review_request": "Examiner la demande",
            "new_notification": "Nouvelle notification",
            "new_comment": "Nouveau commentaire",
            "years": "ans",
            "a_group": "un groupe",
            "footer_reason": "Vous recevez cet e-mail car vous avez activé les notifications. Vous pouvez les désactiver dans vos paramètres.",
            "footer_tagline": "Votre réseau social sûr",
            "post_liked_subject": "{actor} a aimé votre publication !",
            "post_liked_body": "{actor} a aimé l'une de vos publications !",
            "post_liked_body_html": "<strong>{actor}</strong> a aimé l'une de vos publications !",
            "post_commented_subject": "{actor} a commenté votre publication !",
            "post_commented_body": "{actor} a commenté votre publication !",
            "post_commented_body_html": "<strong>{actor}</strong> a commenté votre publication !",
            "comment_liked_subject": "{actor} a aimé votre commentaire !",
            "comment_liked_body": "{actor} a aimé votre commentaire !",
            "comment_liked_body_html": "<strong>{actor}</strong> a aimé votre commentaire !",
            "comment_liked_header": "Commentaire aimé",
            "birthday_subject": "{actor} fête son anniversaire aujourd'hui !",
            "birthday_body": "{actor} fête son anniversaire aujourd'hui !",
            "birthday_body_html": "<strong>{actor}</strong> fête son anniversaire aujourd'hui !",
            "birthday_header": "Anniversaire !",
            "birthday_age_text": "et a {age} ans aujourd'hui",
            "birthday_cta": "Félicitez-le maintenant sur SafeSpace !",
            "group_join_subject": "{actor} veut rejoindre votre groupe !",
            "group_join_body": "{actor} veut rejoindre le groupe \"{group}\".",
            "group_join_body_html": "<strong>{actor}</strong> veut rejoindre le groupe <strong>\"{group}\"</strong>.",
            "group_join_header": "Nouvelle demande d'adhésion",
            "group_join_review": "Veuillez examiner la demande et décider si vous souhaitez l'accepter ou la refuser.",
            "friend_request_subject": "{actor} veut être votre ami !",
            "friend_request_body": "{actor} vous a envoyé une demande d'amitié !",
            "friend_request_body_html": "<strong>{actor}</strong> vous a envoyé une demande d'amitié !",
            "friend_request_header": "Nouvelle demande d'amitié",
            "friend_accepted_subject": "{actor} a accepté votre demande d'amitié !",
            "friend_accepted_body": "{actor} a accepté votre demande d'amitié ! Vous êtes maintenant amis.",
            "friend_accepted_body_html": "<strong>{actor}</strong> a accepté votre demande d'amitié ! Vous êtes maintenant amis.",
            "friend_accepted_header": "Demande d'amitié acceptée",
            "post_shared_subject": "{actor} a partagé une publication avec vous !",
            "post_shared_body": "{actor} a partagé une publication avec vous !",
            "post_shared_body_html": "<strong>{actor}</strong> a partagé une publication avec vous !",
            "post_shared_header": "Publication partagée",
            "welcome_subject": "Bienvenue sur SafeSpace, {username} !",
            "welcome_body": "Bienvenue sur SafeSpace ! Nous sommes ravis de vous accueillir.",
            "welcome_desc": "Découvrez votre fil d'actualité, trouvez des amis et partagez vos pensées. SafeSpace est votre espace — sûr, respectueux et accueillant.",
            "welcome_header": "Bienvenue sur SafeSpace !",
            "welcome_cta": "Commencer",
            "default_subject": "Nouvelle notification de {actor}",
            "default_body": "Vous avez reçu une nouvelle notification.",
            "default_header": "Nouvelle notification",
        },
        "es": {
            "greeting": "Hola {username},",
            "greeting_html": "Hola <strong>{username}</strong>,",
            "closing": "Saludos cordiales,",
            "team": "Tu equipo de SafeSpace",
            "your_post": "Tu publicación",
            "comment_by": "Comentario de {actor}",
            "view_post": "Ver publicación",
            "view_comment": "Ver comentario",
            "view_profile": "Ver perfil",
            "view_group": "Ver grupo",
            "review_request": "Revisar solicitud",
            "new_notification": "Nueva notificación",
            "new_comment": "Nuevo comentario",
            "years": "años",
            "a_group": "un grupo",
            "footer_reason": "Recibes este correo porque tienes las notificaciones activadas. Puedes desactivarlas en tu configuración.",
            "footer_tagline": "Tu red social segura",
            "post_liked_subject": "¡A {actor} le gustó tu publicación!",
            "post_liked_body": "¡A {actor} le gustó una de tus publicaciones!",
            "post_liked_body_html": "¡A <strong>{actor}</strong> le gustó una de tus publicaciones!",
            "post_commented_subject": "¡{actor} comentó tu publicación!",
            "post_commented_body": "¡{actor} comentó tu publicación!",
            "post_commented_body_html": "¡<strong>{actor}</strong> comentó tu publicación!",
            "comment_liked_subject": "¡A {actor} le gustó tu comentario!",
            "comment_liked_body": "¡A {actor} le gustó tu comentario!",
            "comment_liked_body_html": "¡A <strong>{actor}</strong> le gustó tu comentario!",
            "comment_liked_header": "Comentario gustado",
            "birthday_subject": "¡{actor} cumple años hoy!",
            "birthday_body": "¡{actor} cumple años hoy!",
            "birthday_body_html": "¡<strong>{actor}</strong> cumple años hoy!",
            "birthday_header": "¡Cumpleaños!",
            "birthday_age_text": "y cumple {age} años hoy",
            "birthday_cta": "¡Felicítale ahora en SafeSpace!",
            "group_join_subject": "¡{actor} quiere unirse a tu grupo!",
            "group_join_body": "{actor} quiere unirse al grupo \"{group}\".",
            "group_join_body_html": "<strong>{actor}</strong> quiere unirse al grupo <strong>\"{group}\"</strong>.",
            "group_join_header": "Nueva solicitud de unión",
            "group_join_review": "Por favor revisa la solicitud y decide si deseas aceptarla o rechazarla.",
            "friend_request_subject": "¡{actor} quiere ser tu amigo!",
            "friend_request_body": "¡{actor} te ha enviado una solicitud de amistad!",
            "friend_request_body_html": "¡<strong>{actor}</strong> te ha enviado una solicitud de amistad!",
            "friend_request_header": "Nueva solicitud de amistad",
            "friend_accepted_subject": "¡{actor} aceptó tu solicitud de amistad!",
            "friend_accepted_body": "¡{actor} aceptó tu solicitud de amistad! Ahora sois amigos.",
            "friend_accepted_body_html": "¡<strong>{actor}</strong> aceptó tu solicitud de amistad! Ahora sois amigos.",
            "friend_accepted_header": "Solicitud de amistad aceptada",
            "post_shared_subject": "¡{actor} compartió una publicación contigo!",
            "post_shared_body": "¡{actor} compartió una publicación contigo!",
            "post_shared_body_html": "¡<strong>{actor}</strong> compartió una publicación contigo!",
            "post_shared_header": "Publicación compartida",
            "welcome_subject": "¡Bienvenido a SafeSpace, {username}!",
            "welcome_body": "¡Bienvenido a SafeSpace! Nos alegra tenerte.",
            "welcome_desc": "Descubre tu línea de tiempo, encuentra amigos y comparte tus pensamientos. SafeSpace es tu espacio — seguro, respetuoso y acogedor.",
            "welcome_header": "¡Bienvenido a SafeSpace!",
            "welcome_cta": "Empezar",
            "default_subject": "Nueva notificación de {actor}",
            "default_body": "Has recibido una nueva notificación.",
            "default_header": "Nueva notificación",
        },
        "it": {
            "greeting": "Ciao {username},",
            "greeting_html": "Ciao <strong>{username}</strong>,",
            "closing": "Cordiali saluti,",
            "team": "Il tuo team SafeSpace",
            "your_post": "Il tuo post",
            "comment_by": "Commento di {actor}",
            "view_post": "Vedi post",
            "view_comment": "Vedi commento",
            "view_profile": "Vedi profilo",
            "view_group": "Vedi gruppo",
            "review_request": "Esamina richiesta",
            "new_notification": "Nuova notifica",
            "new_comment": "Nuovo commento",
            "years": "anni",
            "a_group": "un gruppo",
            "footer_reason": "Ricevi questa email perché hai le notifiche attivate. Puoi disattivarle nelle impostazioni.",
            "footer_tagline": "Il tuo social network sicuro",
            "post_liked_subject": "A {actor} è piaciuto il tuo post!",
            "post_liked_body": "A {actor} è piaciuto uno dei tuoi post!",
            "post_liked_body_html": "A <strong>{actor}</strong> è piaciuto uno dei tuoi post!",
            "post_commented_subject": "{actor} ha commentato il tuo post!",
            "post_commented_body": "{actor} ha commentato il tuo post!",
            "post_commented_body_html": "<strong>{actor}</strong> ha commentato il tuo post!",
            "comment_liked_subject": "A {actor} è piaciuto il tuo commento!",
            "comment_liked_body": "A {actor} è piaciuto il tuo commento!",
            "comment_liked_body_html": "A <strong>{actor}</strong> è piaciuto il tuo commento!",
            "comment_liked_header": "Commento piaciuto",
            "birthday_subject": "{actor} compie gli anni oggi!",
            "birthday_body": "{actor} compie gli anni oggi!",
            "birthday_body_html": "<strong>{actor}</strong> compie gli anni oggi!",
            "birthday_header": "Compleanno!",
            "birthday_age_text": "e compie {age} anni oggi",
            "birthday_cta": "Fai gli auguri su SafeSpace!",
            "group_join_subject": "{actor} vuole unirsi al tuo gruppo!",
            "group_join_body": "{actor} vuole unirsi al gruppo \"{group}\".",
            "group_join_body_html": "<strong>{actor}</strong> vuole unirsi al gruppo <strong>\"{group}\"</strong>.",
            "group_join_header": "Nuova richiesta di adesione",
            "group_join_review": "Esamina la richiesta e decidi se accettarla o rifiutarla.",
            "friend_request_subject": "{actor} vuole essere tuo amico!",
            "friend_request_body": "{actor} ti ha inviato una richiesta di amicizia!",
            "friend_request_body_html": "<strong>{actor}</strong> ti ha inviato una richiesta di amicizia!",
            "friend_request_header": "Nuova richiesta di amicizia",
            "friend_accepted_subject": "{actor} ha accettato la tua richiesta di amicizia!",
            "friend_accepted_body": "{actor} ha accettato la tua richiesta di amicizia! Ora siete amici.",
            "friend_accepted_body_html": "<strong>{actor}</strong> ha accettato la tua richiesta di amicizia! Ora siete amici.",
            "friend_accepted_header": "Richiesta di amicizia accettata",
            "post_shared_subject": "{actor} ha condiviso un post con te!",
            "post_shared_body": "{actor} ha condiviso un post con te!",
            "post_shared_body_html": "<strong>{actor}</strong> ha condiviso un post con te!",
            "post_shared_header": "Post condiviso",
            "welcome_subject": "Benvenuto su SafeSpace, {username}!",
            "welcome_body": "Benvenuto su SafeSpace! Siamo felici di averti.",
            "welcome_desc": "Scopri la tua timeline, trova amici e condividi i tuoi pensieri. SafeSpace è il tuo spazio — sicuro, rispettoso e accogliente.",
            "welcome_header": "Benvenuto su SafeSpace!",
            "welcome_cta": "Inizia ora",
            "default_subject": "Nuova notifica da {actor}",
            "default_body": "Hai ricevuto una nuova notifica.",
            "default_header": "Nuova notifica",
        },
        "pt": {
            "greeting": "Olá {username},",
            "greeting_html": "Olá <strong>{username}</strong>,",
            "closing": "Atenciosamente,",
            "team": "Sua equipe SafeSpace",
            "your_post": "Sua publicação",
            "comment_by": "Comentário de {actor}",
            "view_post": "Ver publicação",
            "view_comment": "Ver comentário",
            "view_profile": "Ver perfil",
            "view_group": "Ver grupo",
            "review_request": "Revisar solicitação",
            "new_notification": "Nova notificação",
            "new_comment": "Novo comentário",
            "years": "anos",
            "a_group": "um grupo",
            "footer_reason": "Você recebe este e-mail porque tem as notificações ativadas. Pode desativá-las nas configurações.",
            "footer_tagline": "Sua rede social segura",
            "post_liked_subject": "{actor} curtiu sua publicação!",
            "post_liked_body": "{actor} curtiu uma de suas publicações!",
            "post_liked_body_html": "<strong>{actor}</strong> curtiu uma de suas publicações!",
            "post_commented_subject": "{actor} comentou sua publicação!",
            "post_commented_body": "{actor} comentou sua publicação!",
            "post_commented_body_html": "<strong>{actor}</strong> comentou sua publicação!",
            "comment_liked_subject": "{actor} curtiu seu comentário!",
            "comment_liked_body": "{actor} curtiu seu comentário!",
            "comment_liked_body_html": "<strong>{actor}</strong> curtiu seu comentário!",
            "comment_liked_header": "Comentário curtido",
            "birthday_subject": "{actor} faz aniversário hoje!",
            "birthday_body": "{actor} faz aniversário hoje!",
            "birthday_body_html": "<strong>{actor}</strong> faz aniversário hoje!",
            "birthday_header": "Aniversário!",
            "birthday_age_text": "e faz {age} anos hoje",
            "birthday_cta": "Parabenize agora no SafeSpace!",
            "group_join_subject": "{actor} quer entrar no seu grupo!",
            "group_join_body": "{actor} quer entrar no grupo \"{group}\".",
            "group_join_body_html": "<strong>{actor}</strong> quer entrar no grupo <strong>\"{group}\"</strong>.",
            "group_join_header": "Nova solicitação de entrada",
            "group_join_review": "Por favor, revise a solicitação e decida se deseja aceitá-la ou recusá-la.",
            "friend_request_subject": "{actor} quer ser seu amigo!",
            "friend_request_body": "{actor} enviou uma solicitação de amizade!",
            "friend_request_body_html": "<strong>{actor}</strong> enviou uma solicitação de amizade!",
            "friend_request_header": "Nova solicitação de amizade",
            "friend_accepted_subject": "{actor} aceitou sua solicitação de amizade!",
            "friend_accepted_body": "{actor} aceitou sua solicitação de amizade! Agora vocês são amigos.",
            "friend_accepted_body_html": "<strong>{actor}</strong> aceitou sua solicitação de amizade! Agora vocês são amigos.",
            "friend_accepted_header": "Solicitação de amizade aceita",
            "post_shared_subject": "{actor} compartilhou uma publicação com você!",
            "post_shared_body": "{actor} compartilhou uma publicação com você!",
            "post_shared_body_html": "<strong>{actor}</strong> compartilhou uma publicação com você!",
            "post_shared_header": "Publicação compartilhada",
            "welcome_subject": "Bem-vindo ao SafeSpace, {username}!",
            "welcome_body": "Bem-vindo ao SafeSpace! Estamos felizes em tê-lo.",
            "welcome_desc": "Descubra sua linha do tempo, encontre amigos e compartilhe seus pensamentos. SafeSpace é seu espaço — seguro, respeitoso e acolhedor.",
            "welcome_header": "Bem-vindo ao SafeSpace!",
            "welcome_cta": "Começar agora",
            "default_subject": "Nova notificação de {actor}",
            "default_body": "Você recebeu uma nova notificação.",
            "default_header": "Nova notificação",
        },
        "nl": {
            "greeting": "Hallo {username},",
            "greeting_html": "Hallo <strong>{username}</strong>,",
            "closing": "Met vriendelijke groeten,",
            "team": "Je SafeSpace Team",
            "your_post": "Je bericht",
            "comment_by": "Reactie van {actor}",
            "view_post": "Bericht bekijken",
            "view_comment": "Reactie bekijken",
            "view_profile": "Profiel bekijken",
            "view_group": "Groep bekijken",
            "review_request": "Verzoek beoordelen",
            "new_notification": "Nieuwe melding",
            "new_comment": "Nieuwe reactie",
            "years": "jaar",
            "a_group": "een groep",
            "footer_reason": "Je ontvangt deze e-mail omdat je meldingen hebt ingeschakeld. Je kunt deze uitschakelen in je instellingen.",
            "footer_tagline": "Je veilige sociale netwerk",
            "post_liked_subject": "{actor} vond je bericht leuk!",
            "post_liked_body": "{actor} vond een van je berichten leuk!",
            "post_liked_body_html": "<strong>{actor}</strong> vond een van je berichten leuk!",
            "post_commented_subject": "{actor} heeft gereageerd op je bericht!",
            "post_commented_body": "{actor} heeft gereageerd op je bericht!",
            "post_commented_body_html": "<strong>{actor}</strong> heeft gereageerd op je bericht!",
            "comment_liked_subject": "{actor} vond je reactie leuk!",
            "comment_liked_body": "{actor} vond je reactie leuk!",
            "comment_liked_body_html": "<strong>{actor}</strong> vond je reactie leuk!",
            "comment_liked_header": "Reactie leuk gevonden",
            "birthday_subject": "{actor} is vandaag jarig!",
            "birthday_body": "{actor} is vandaag jarig!",
            "birthday_body_html": "<strong>{actor}</strong> is vandaag jarig!",
            "birthday_header": "Verjaardag!",
            "birthday_age_text": "en wordt vandaag {age} jaar",
            "birthday_cta": "Feliciteer nu op SafeSpace!",
            "group_join_subject": "{actor} wil lid worden van je groep!",
            "group_join_body": "{actor} wil lid worden van de groep \"{group}\".",
            "group_join_body_html": "<strong>{actor}</strong> wil lid worden van de groep <strong>\"{group}\"</strong>.",
            "group_join_header": "Nieuw lidmaatschapsverzoek",
            "group_join_review": "Beoordeel het verzoek en beslis of je het wilt accepteren of weigeren.",
            "friend_request_subject": "{actor} wil je vriend worden!",
            "friend_request_body": "{actor} heeft je een vriendschapsverzoek gestuurd!",
            "friend_request_body_html": "<strong>{actor}</strong> heeft je een vriendschapsverzoek gestuurd!",
            "friend_request_header": "Nieuw vriendschapsverzoek",
            "friend_accepted_subject": "{actor} heeft je vriendschapsverzoek geaccepteerd!",
            "friend_accepted_body": "{actor} heeft je vriendschapsverzoek geaccepteerd! Jullie zijn nu vrienden.",
            "friend_accepted_body_html": "<strong>{actor}</strong> heeft je vriendschapsverzoek geaccepteerd! Jullie zijn nu vrienden.",
            "friend_accepted_header": "Vriendschapsverzoek geaccepteerd",
            "post_shared_subject": "{actor} heeft een bericht met je gedeeld!",
            "post_shared_body": "{actor} heeft een bericht met je gedeeld!",
            "post_shared_body_html": "<strong>{actor}</strong> heeft een bericht met je gedeeld!",
            "post_shared_header": "Bericht gedeeld",
            "welcome_subject": "Welkom bij SafeSpace, {username}!",
            "welcome_body": "Welkom bij SafeSpace! We zijn blij dat je erbij bent.",
            "welcome_desc": "Ontdek je tijdlijn, vind vrienden en deel je gedachten. SafeSpace is jouw ruimte — veilig, respectvol en uitnodigend.",
            "welcome_header": "Welkom bij SafeSpace!",
            "welcome_cta": "Nu beginnen",
            "default_subject": "Nieuwe melding van {actor}",
            "default_body": "Je hebt een nieuwe melding ontvangen.",
            "default_header": "Nieuwe melding",
        },
        "pl": {
            "greeting": "Cześć {username},",
            "greeting_html": "Cześć <strong>{username}</strong>,",
            "closing": "Pozdrawiamy,",
            "team": "Twój zespół SafeSpace",
            "your_post": "Twój post",
            "comment_by": "Komentarz od {actor}",
            "view_post": "Zobacz post",
            "view_comment": "Zobacz komentarz",
            "view_profile": "Zobacz profil",
            "view_group": "Zobacz grupę",
            "review_request": "Sprawdź prośbę",
            "new_notification": "Nowe powiadomienie",
            "new_comment": "Nowy komentarz",
            "years": "lat",
            "a_group": "grupy",
            "footer_reason": "Otrzymujesz ten e-mail, ponieważ masz włączone powiadomienia. Możesz je wyłączyć w ustawieniach.",
            "footer_tagline": "Twoja bezpieczna sieć społecznościowa",
            "post_liked_subject": "{actor} polubił(a) Twój post!",
            "post_liked_body": "{actor} polubił(a) jeden z Twoich postów!",
            "post_liked_body_html": "<strong>{actor}</strong> polubił(a) jeden z Twoich postów!",
            "post_commented_subject": "{actor} skomentował(a) Twój post!",
            "post_commented_body": "{actor} skomentował(a) Twój post!",
            "post_commented_body_html": "<strong>{actor}</strong> skomentował(a) Twój post!",
            "comment_liked_subject": "{actor} polubił(a) Twój komentarz!",
            "comment_liked_body": "{actor} polubił(a) Twój komentarz!",
            "comment_liked_body_html": "<strong>{actor}</strong> polubił(a) Twój komentarz!",
            "comment_liked_header": "Komentarz polubiony",
            "birthday_subject": "{actor} ma dziś urodziny!",
            "birthday_body": "{actor} ma dziś urodziny!",
            "birthday_body_html": "<strong>{actor}</strong> ma dziś urodziny!",
            "birthday_header": "Urodziny!",
            "birthday_age_text": "i kończy dziś {age} lat",
            "birthday_cta": "Złóż życzenia na SafeSpace!",
            "group_join_subject": "{actor} chce dołączyć do Twojej grupy!",
            "group_join_body": "{actor} chce dołączyć do grupy \"{group}\".",
            "group_join_body_html": "<strong>{actor}</strong> chce dołączyć do grupy <strong>\"{group}\"</strong>.",
            "group_join_header": "Nowa prośba o dołączenie",
            "group_join_review": "Sprawdź prośbę i zdecyduj, czy chcesz ją zaakceptować, czy odrzucić.",
            "friend_request_subject": "{actor} chce być Twoim znajomym!",
            "friend_request_body": "{actor} wysłał(a) Ci zaproszenie do znajomych!",
            "friend_request_body_html": "<strong>{actor}</strong> wysłał(a) Ci zaproszenie do znajomych!",
            "friend_request_header": "Nowe zaproszenie do znajomych",
            "friend_accepted_subject": "{actor} zaakceptował(a) Twoje zaproszenie!",
            "friend_accepted_body": "{actor} zaakceptował(a) Twoje zaproszenie do znajomych! Teraz jesteście znajomymi.",
            "friend_accepted_body_html": "<strong>{actor}</strong> zaakceptował(a) Twoje zaproszenie do znajomych! Teraz jesteście znajomymi.",
            "friend_accepted_header": "Zaproszenie zaakceptowane",
            "post_shared_subject": "{actor} udostępnił(a) Ci post!",
            "post_shared_body": "{actor} udostępnił(a) Ci post!",
            "post_shared_body_html": "<strong>{actor}</strong> udostępnił(a) Ci post!",
            "post_shared_header": "Post udostępniony",
            "welcome_subject": "Witamy w SafeSpace, {username}!",
            "welcome_body": "Witamy w SafeSpace! Cieszymy się, że jesteś z nami.",
            "welcome_desc": "Odkryj swoją oś czasu, znajdź znajomych i dziel się myślami. SafeSpace to Twoja przestrzeń — bezpieczna, pełna szacunku i przyjazna.",
            "welcome_header": "Witamy w SafeSpace!",
            "welcome_cta": "Zacznij teraz",
            "default_subject": "Nowe powiadomienie od {actor}",
            "default_body": "Otrzymałeś nowe powiadomienie.",
            "default_header": "Nowe powiadomienie",
        },
    }

    @classmethod
    async def send_email(
        cls,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Sendet eine E-Mail.

        Args:
            to_email: Empfänger E-Mail
            subject: Betreff
            html_content: HTML Inhalt
            text_content: Plain-Text Alternative (optional)

        Returns:
            bool: True wenn erfolgreich, False bei Fehler
        """
        # Wenn Email disabled ist, skip
        if not settings.email_enabled:
            print(f"📧 Email disabled - Would send to {to_email}: {subject}")
            return False

        try:
            # E-Mail erstellen
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            msg['Date'] = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')

            # Text-Version hinzufügen (Fallback)
            if text_content:
                part1 = MIMEText(text_content, 'plain', 'utf-8')
                msg.attach(part1)

            # HTML-Version hinzufügen
            part2 = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(part2)

            # SMTP-Verbindung aufbauen und senden
            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
                server.starttls()
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)

            # Login falls Credentials vorhanden
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)

            # E-Mail senden
            server.send_message(msg)
            server.quit()

            print(f"✅ Email sent to {to_email}: {subject}")
            return True

        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {e}")
            return False

    @classmethod
    async def send_notification_email(
        cls,
        to_email: str,
        to_username: str,
        actor_username: str,
        notification_type: str,
        post_id: Optional[int] = None,
        post_author_uid: Optional[int] = None,
        comment_id: Optional[int] = None,
        post_content: Optional[str] = None,
        comment_content: Optional[str] = None,
        birthday_age: Optional[int] = None,
        user_language: str = "de",
        group_id: Optional[int] = None,
        group_name: Optional[str] = None
    ) -> bool:
        """
        Sendet eine Benachrichtigungs-E-Mail.
        Verwendet gespeicherte Templates falls vorhanden, sonst Standard-Templates.
        """
        # Site URL aus Einstellungen laden
        try:
            site_url = await get_site_url()
        except Exception:
            site_url = "http://localhost:4200"

        # Betreff und Nachricht basierend auf Typ
        subject, html_content, text_content = cls._build_notification_email(
            to_username, actor_username, notification_type, post_id, comment_id, site_url,
            post_content=post_content, comment_content=comment_content, birthday_age=birthday_age,
            group_id=group_id, group_name=group_name, user_language=user_language
        )

        return await cls.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )

    @classmethod
    def _build_from_template(
        cls,
        template: dict,
        to_username: str,
        actor_username: str,
        post_id: Optional[int],
        post_content: Optional[str] = None,
        comment_content: Optional[str] = None,
        birthday_age: Optional[int] = None,
        site_url: str = "http://localhost:4200"
    ) -> tuple[str, str, str]:
        """Erstellt E-Mail aus gespeichertem Template mit Platzhalter-Ersetzung."""
        import html as html_module
        import re

        post_link = f"{site_url}/my-posts?highlight={post_id}" if post_id else ""

        # Post-Inhalt Block
        post_content_html = ""
        if post_content:
            truncated = post_content[:300] + ("..." if len(post_content) > 300 else "")
            safe_content = html_module.escape(truncated)
            post_content_html = f'<div style="background: #f0f2f5; border-left: 4px solid #1877f2; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">{safe_content}</div>'

        # Kommentar Block
        comment_content_html = ""
        if comment_content:
            truncated_comment = comment_content[:300] + ("..." if len(comment_content) > 300 else "")
            safe_comment = html_module.escape(truncated_comment)
            comment_content_html = f'<div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">{safe_comment}</div>'

        # Action Button
        action_button_html = ""
        if post_link:
            action_button_html = f"<a href='{post_link}' class='button'>Post ansehen</a>"

        # Birthday Age Block
        birthday_age_html = ""
        if birthday_age:
            birthday_age_html = f'<p style="font-size: 24px; text-align: center; margin: 16px 0;">🎉 <strong>{birthday_age}</strong> 🎉</p>'

        # Platzhalter ersetzen
        subject = template["subject"]
        subject = subject.replace("{{username}}", to_username)
        subject = subject.replace("{{actor}}", actor_username)

        body = template["body"]
        body = body.replace("{{username}}", to_username)
        body = body.replace("{{actor}}", actor_username)
        body = body.replace("{{post_content}}", post_content_html)
        body = body.replace("{{comment_content}}", comment_content_html)
        body = body.replace("{{action_button}}", action_button_html)
        body = body.replace("{{birthday_age}}", birthday_age_html)

        html = cls._wrap_email_html("🔔", body)

        # Einfache Text-Version
        text = re.sub(r'<[^>]+>', '', body)
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")

        return subject, html, text

    @classmethod
    def _build_notification_email(
        cls,
        to_username: str,
        actor_username: str,
        notification_type: str,
        post_id: Optional[int],
        comment_id: Optional[int],
        site_url: str = "http://localhost:4200",
        post_content: Optional[str] = None,
        comment_content: Optional[str] = None,
        birthday_age: Optional[int] = None,
        group_id: Optional[int] = None,
        group_name: Optional[str] = None,
        user_language: str = "de"
    ) -> tuple[str, str, str]:
        """
        Erstellt Betreff und Inhalt für Benachrichtigungs-E-Mails.
        Unterstützt mehrere Sprachen über den user_language Parameter.

        Returns:
            (subject, html_content, text_content)
        """
        lang = user_language if user_language in cls._EMAIL_STRINGS else "en"

        s = cls._EMAIL_STRINGS[lang]

        # Post-Link (wenn verfügbar) - verwendet konfigurierte Site-URL
        post_link = f"{site_url}/my-posts?highlight={post_id}" if post_id else ""

        # Post-Inhalt HTML-Block
        post_content_html = ""
        post_content_text = ""
        if post_content:
            truncated = post_content[:300] + ("..." if len(post_content) > 300 else "")
            import html as html_module
            safe_content = html_module.escape(truncated)
            post_content_html = f"""
                <div style="background: #f0f2f5; border-left: 4px solid #1877f2; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">
                    <strong>{s['your_post']}:</strong><br>{safe_content}
                </div>"""
            post_content_text = f"\n\n{s['your_post']}:\n\"{truncated}\"\n"

        # Kommentar-Inhalt HTML-Block
        comment_content_html = ""
        comment_content_text = ""
        if comment_content:
            truncated_comment = comment_content[:300] + ("..." if len(comment_content) > 300 else "")
            import html as html_module
            safe_comment = html_module.escape(truncated_comment)
            comment_content_html = f"""
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">
                    <strong>{s['comment_by'].format(actor=actor_username)}:</strong><br>{safe_comment}
                </div>"""
            comment_content_text = f"\n\n{s['comment_by'].format(actor=actor_username)}:\n\"{truncated_comment}\"\n"

        if notification_type == "post_liked":
            subject = f"🎉 {s['post_liked_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['post_liked_body'].format(actor=actor_username)}
{post_content_text}
{s['view_post']}: {post_link}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"🎉 {s['new_notification']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['post_liked_body_html'].format(actor=actor_username)}</p>
                {post_content_html}
                {"<a href='" + post_link + "' class='button'>" + s['view_post'] + "</a>" if post_link else ""}""",
                lang
            )

        elif notification_type == "post_commented":
            subject = f"💬 {s['post_commented_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['post_commented_body'].format(actor=actor_username)}
{post_content_text}{comment_content_text}
{s['view_comment']}: {post_link}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"💬 {s['new_comment']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['post_commented_body_html'].format(actor=actor_username)}</p>
                {post_content_html}
                {comment_content_html}
                {"<a href='" + post_link + "' class='button'>" + s['view_comment'] + "</a>" if post_link else ""}""",
                lang
            )

        elif notification_type == "comment_liked":
            subject = f"👍 {s['comment_liked_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['comment_liked_body'].format(actor=actor_username)}
{post_content_text}
{s['view_post']}: {post_link}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"👍 {s['comment_liked_header']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['comment_liked_body_html'].format(actor=actor_username)}</p>
                {post_content_html}
                {"<a href='" + post_link + "' class='button'>" + s['view_post'] + "</a>" if post_link else ""}""",
                lang
            )

        elif notification_type == "birthday":
            age_text = f" {s['birthday_age_text'].format(age=birthday_age)}" if birthday_age else ""
            subject = f"🎂 {s['birthday_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['birthday_body'].format(actor=actor_username)}{age_text}

{s['birthday_cta']}

{s['closing']}
{s['team']}""".strip()

            age_html = f"<p style='font-size: 24px; text-align: center; margin: 16px 0;'>🎉 <strong>{birthday_age} {s['years']}</strong> 🎉</p>" if birthday_age else ""
            html = cls._wrap_email_html(
                f"🎂 {s['birthday_header']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['birthday_body_html'].format(actor=actor_username)}</p>
                {age_html}
                <p>{s['birthday_cta']}</p>""",
                lang
            )

        elif notification_type == "group_join_request":
            group_link = f"{site_url}/groups/{group_id}" if group_id else ""
            group_display_name = group_name or s['a_group']
            subject = f"👥 {s['group_join_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['group_join_body'].format(actor=actor_username, group=group_display_name)}

{s['group_join_review']}

{f"{s['view_group']}: {group_link}" if group_link else ""}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"👥 {s['group_join_header']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['group_join_body_html'].format(actor=actor_username, group=group_display_name)}</p>
                <p>{s['group_join_review']}</p>
                {"<a href='" + group_link + "' class='button'>" + s['review_request'] + "</a>" if group_link else ""}""",
                lang
            )

        elif notification_type == "friend_request":
            profile_link = f"{site_url}/profile/{actor_username}"
            subject = f"👋 {s['friend_request_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['friend_request_body'].format(actor=actor_username)}

{s['view_profile']}: {profile_link}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"👋 {s['friend_request_header']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['friend_request_body_html'].format(actor=actor_username)}</p>
                <a href='{profile_link}' class='button'>{s['view_profile']}</a>""",
                lang
            )

        elif notification_type == "friend_request_accepted":
            profile_link = f"{site_url}/profile/{actor_username}"
            subject = f"🎉 {s['friend_accepted_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['friend_accepted_body'].format(actor=actor_username)}

{s['view_profile']}: {profile_link}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"🎉 {s['friend_accepted_header']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['friend_accepted_body_html'].format(actor=actor_username)}</p>
                <a href='{profile_link}' class='button'>{s['view_profile']}</a>""",
                lang
            )

        elif notification_type == "post_shared":
            shared_post_link = f"{site_url}"
            subject = f"📨 {s['post_shared_subject'].format(actor=actor_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['post_shared_body'].format(actor=actor_username)}

{s['view_post']}: {shared_post_link}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"📨 {s['post_shared_header']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['post_shared_body_html'].format(actor=actor_username)}</p>
                <a href='{shared_post_link}' class='button'>{s['view_post']}</a>""",
                lang
            )

        elif notification_type == "welcome":
            subject = f"🎉 {s['welcome_subject'].format(username=to_username)}"
            text = f"""{s['greeting'].format(username=to_username)}

{s['welcome_body']}

{s['welcome_desc']}

{s['welcome_cta']}: {site_url}

{s['closing']}
{s['team']}""".strip()

            html = cls._wrap_email_html(
                f"🎉 {s['welcome_header']}",
                f"""<p>{s['greeting_html'].format(username=to_username)}</p>
                <p>{s['welcome_body']}</p>
                <p>{s['welcome_desc']}</p>
                <a href='{site_url}' class='button'>{s['welcome_cta']}</a>""",
                lang
            )

        else:
            subject = f"🔔 {s['default_subject'].format(actor=actor_username)}"
            text = f"{s['greeting'].format(username=to_username)}\n\n{s['default_body']}\n\n{s['closing']}\n{s['team']}"
            html = cls._wrap_email_html(
                f"🔔 {s['default_header']}",
                f"<p>{s['greeting_html'].format(username=to_username)}</p><p>{s['default_body']}</p>",
                lang
            )

        return subject, html, text

    @classmethod
    def _wrap_email_html(cls, header_title: str, body_content: str, lang: str = "de") -> str:
        """Wraps email body content in the standard HTML template."""
        s = cls._EMAIL_STRINGS.get(lang, cls._EMAIL_STRINGS["en"])
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #1877f2, #42b72a); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .notification {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .button {{ display: inline-block; padding: 12px 30px; background: #1877f2; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{header_title}</h1>
        </div>
        <div class="content">
            <div class="notification">
                {body_content}
            </div>
            <div class="footer">
                <p>{s['footer_reason']}</p>
                <p>SafeSpace - {s['footer_tagline']}</p>
            </div>
        </div>
    </div>
</body>
</html>
        """.strip()

    @classmethod
    async def send_parental_consent_email(
        cls,
        parent_email: str,
        child_username: str,
        consent_link: str
    ) -> bool:
        """Sendet die Einwilligungsanfrage an die Eltern eines minderjährigen Nutzers"""
        subject = f"SafeSpace – Elterliche Einwilligung für {child_username}"

        body_html = f"""
            <h2>Elterliche Einwilligung erforderlich</h2>
            <p>Der Benutzer <strong>{child_username}</strong> möchte sich bei SafeSpace registrieren
               und ist unter 16 Jahre alt.</p>
            <p>Gemäß Art. 8 DSGVO benötigen Minderjährige unter 16 Jahren die Einwilligung
               eines Erziehungsberechtigten zur Nutzung von Social-Media-Diensten.</p>
            <p>Wenn Sie damit einverstanden sind, dass <strong>{child_username}</strong> SafeSpace nutzt,
               klicken Sie bitte auf den folgenden Link:</p>
            <p style="text-align: center;">
                <a href="{consent_link}" style="display: inline-block; padding: 14px 32px; background: #42b72a; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Einwilligung erteilen
                </a>
            </p>
            <p style="color: #666; font-size: 13px;">Oder kopieren Sie diesen Link in Ihren Browser:<br/>
               <a href="{consent_link}">{consent_link}</a></p>
            <p style="color: #666; font-size: 13px;">Solange die Einwilligung nicht erteilt wurde,
               ist der Account eingeschränkt.</p>
            <p style="color: #999; font-size: 12px;">Falls Sie diese Anfrage nicht kennen, können Sie diese E-Mail ignorieren.</p>
        """

        html_content = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
    .header {{ background: linear-gradient(135deg, #1877f2, #42b72a); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
    .notification {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
    .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; }}
</style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>SafeSpace – Jugendschutz</h1></div>
        <div class="content">
            <div class="notification">{body_html}</div>
            <div class="footer">
                <p>SafeSpace - Dein sicheres Social Network</p>
            </div>
        </div>
    </div>
</body>
</html>"""

        return await cls._send_email(parent_email, subject, html_content)
