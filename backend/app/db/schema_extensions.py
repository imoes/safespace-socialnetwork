"""
Erweiterte Datenbankschemas für:
- User-Rollen (user, moderator, admin)
- Beziehungstypen (family, close_friend, acquaintance)
- Post-Reports (Meldungen)
- Moderator-Aktionen
"""

EXTENDED_SCHEMA = """
-- User Rollen
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Beziehungstypen für Freundschaften
DO $$ BEGIN
    CREATE TYPE relationship_type AS ENUM ('family', 'close_friend', 'acquaintance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report Status
DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Moderator Action Types
DO $$ BEGIN
    CREATE TYPE mod_action_type AS ENUM (
        'approve', 'flag', 'block', 'delete', 
        'warn_user', 'suspend_user', 'ban_user',
        'dismiss_report'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users Tabelle erweitern
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;

-- Friendships erweitern mit Beziehungstyp
ALTER TABLE friendships
ADD COLUMN IF NOT EXISTS relationship relationship_type DEFAULT 'acquaintance';

-- Post Reports Tabelle
CREATE TABLE IF NOT EXISTS post_reports (
    report_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    post_author_uid INTEGER NOT NULL REFERENCES users(uid),
    reporter_uid INTEGER NOT NULL REFERENCES users(uid),
    reason TEXT NOT NULL,
    category VARCHAR(50),  -- hate_speech, harassment, spam, inappropriate, other
    description TEXT,
    status report_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Moderator der den Report bearbeitet
    assigned_moderator_uid INTEGER REFERENCES users(uid),
    assigned_at TIMESTAMP,
    
    -- Resolution
    resolved_by_uid INTEGER REFERENCES users(uid),
    resolved_at TIMESTAMP,
    resolution_note TEXT
);

-- Moderator Actions Log
CREATE TABLE IF NOT EXISTS moderator_actions (
    action_id SERIAL PRIMARY KEY,
    moderator_uid INTEGER NOT NULL REFERENCES users(uid),
    action_type mod_action_type NOT NULL,
    
    -- Target (Post oder User)
    target_post_id INTEGER,
    target_user_uid INTEGER REFERENCES users(uid),
    
    -- Kontext
    report_id INTEGER REFERENCES post_reports(report_id),
    safespace_report_path TEXT,  -- MinIO Pfad zum SafeSpace Report
    
    -- Details
    reason TEXT,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_reports_status ON post_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_post ON post_reports(post_id, post_author_uid);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON post_reports(reporter_uid);
CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator ON moderator_actions(moderator_uid);
CREATE INDEX IF NOT EXISTS idx_mod_actions_target_user ON moderator_actions(target_user_uid);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_friendships_relationship ON friendships(relationship);
"""


VISIBILITY_LEVELS = {
    "public": 0,       # Jeder
    "acquaintance": 1, # Bekannte + höher
    "close_friend": 2, # Enge Freunde + höher
    "family": 3,       # Nur Familie
    "private": 4       # Nur selbst
}


def can_view_post(viewer_relationship: str | None, post_visibility: str) -> bool:
    """
    Prüft ob ein Viewer einen Post sehen darf basierend auf Beziehung und Sichtbarkeit.
    
    viewer_relationship: None (kein Freund), 'acquaintance', 'close_friend', 'family'
    post_visibility: 'public', 'acquaintance', 'close_friend', 'family', 'private'
    """
    if post_visibility == "public":
        return True
    
    if post_visibility == "private":
        return False  # Nur der Autor selbst
    
    if viewer_relationship is None:
        return False  # Kein Freund, kein Zugriff auf nicht-öffentliche Posts
    
    viewer_level = VISIBILITY_LEVELS.get(viewer_relationship, 0)
    required_level = VISIBILITY_LEVELS.get(post_visibility, 4)
    
    # Viewer-Level muss >= Required Level sein
    # Familie (3) kann alles sehen, Bekannte (1) nur acquaintance und public
    return viewer_level >= required_level
