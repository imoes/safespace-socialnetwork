#!/usr/bin/env python3
"""
Script to create test posts for multiple users
"""
import requests
import random
import time
from datetime import datetime

API_BASE = "http://localhost:8000/api"
USERS = [
    {"username": "tomate81", "password": "9xmg82bw"},
    {"username": "tomate", "password": "9xmg82bw"},
    {"username": "Max", "password": "9xmg82bw"}
]

POSTS_PER_USER = 500

# Verschiedene Hashtags
HASHTAGS = [
    "#coding", "#python", "#javascript", "#webdev", "#ai", "#machinelearning",
    "#fitness", "#sport", "#yoga", "#running", "#cycling", "#swimming",
    "#food", "#cooking", "#baking", "#vegan", "#vegetarian", "#foodie",
    "#travel", "#adventure", "#beach", "#mountains", "#hiking", "#camping",
    "#music", "#concert", "#festival", "#guitar", "#piano", "#singing",
    "#photography", "#art", "#painting", "#drawing", "#design", "#creative",
    "#books", "#reading", "#writing", "#poetry", "#literature", "#fantasy",
    "#movies", "#cinema", "#netflix", "#series", "#tv", "#film",
    "#gaming", "#gamer", "#esports", "#playstation", "#xbox", "#nintendo",
    "#nature", "#animals", "#dogs", "#cats", "#wildlife", "#environment",
    "#motivation", "#inspiration", "#mindfulness", "#meditation", "#selfcare",
    "#tech", "#innovation", "#startup", "#business", "#entrepreneur",
    "#fashion", "#style", "#outfit", "#beauty", "#makeup", "#skincare",
    "#coffee", "#tea", "#cafe", "#breakfast", "#lunch", "#dinner"
]

# Verschiedene Post-Templates
POST_TEMPLATES = [
    "Heute {activity} {hashtags} ✨",
    "Gerade {emotion} wegen {topic} {hashtags}",
    "{opinion} {hashtags}",
    "Wer kennt das auch? {situation} {hashtags} 😄",
    "{question} {hashtags}",
    "Reminder: {reminder} {hashtags} 💪",
    "Plot Twist: {plottwist} {hashtags}",
    "Fun Fact: {funfact} {hashtags} 🤓",
    "Unpopular Opinion: {unpopular} {hashtags}",
    "Ich liebe es wenn {love} {hashtags} ❤️",
    "{weather} perfekt für {activity} {hashtags}",
    "Gerade {food} gemacht {hashtags} 🍽️",
    "Neues Projekt: {project} {hashtags} 🚀",
    "Throwback zu {memory} {hashtags} 📸",
    "Kann nicht glauben dass {surprise} {hashtags} 😱",
]

ACTIVITIES = [
    "war ich laufen", "habe ich programmiert", "habe ich gekocht",
    "habe ich ein Buch gelesen", "war ich im Gym", "habe ich meditiert",
    "war ich spazieren", "habe ich gearbeitet", "habe ich entspannt",
    "war ich fotografieren", "habe ich Musik gemacht", "habe ich gezeichnet"
]

EMOTIONS = [
    "total happy", "super motiviert", "richtig entspannt", "mega stolz",
    "voll begeistert", "so dankbar", "absolut zufrieden", "echt froh"
]

TOPICS = [
    "meinem neuen Projekt", "dem Wetter", "meinem Workout",
    "diesem Film", "dem Essen", "der Musik", "dem Buch",
    "meinem Code", "dem Training", "der Natur"
]

OPINIONS = [
    "Das war der beste Tag seit langem!",
    "Manchmal sind die einfachen Dinge die besten.",
    "Heute mal wieder gelernt: Niemals aufgeben!",
    "Kleine Erfolge sind auch Erfolge.",
    "Das Leben ist zu kurz für schlechte Vibes.",
]

SITUATIONS = [
    "Der Code funktioniert beim ersten Mal",
    "Das Essen sieht besser aus als erwartet",
    "Der Bus kommt pünktlich",
    "Man findet einen freien Parkplatz",
    "Das WLAN ist schnell"
]

QUESTIONS = [
    "Was ist eure liebste Jahreszeit?",
    "Kaffee oder Tee?",
    "Welches Buch könnt ihr empfehlen?",
    "Was war euer Highlight heute?",
    "Welchen Film habt ihr zuletzt gesehen?"
]

REMINDERS = [
    "Pausen sind wichtig!",
    "Genug Wasser trinken!",
    "Bewegung tut gut!",
    "Du bist genug!",
    "Kleine Schritte zählen auch!"
]

PLOTTWISTS = [
    "Es war doch kein Montag",
    "Der Kaffee war koffeinfrei",
    "Es gab noch Kuchen im Kühlschrank",
    "Die Deadline wurde verschoben",
    "Das Meeting wurde abgesagt"
]

FUNFACTS = [
    "Schmetterlinge schmecken mit ihren Füßen",
    "Honig verdirbt nie",
    "Oktopusse haben drei Herzen",
    "Bananen sind Beeren, Erdbeeren nicht",
    "Ein Tag auf Venus ist länger als ein Jahr"
]

UNPOPULAR = [
    "Pineapple auf Pizza ist okay",
    "Tabs sind besser als Spaces",
    "Dark Mode ist überbewertet",
    "Kaffee ohne Zucker schmeckt besser",
    "Comics sind Literatur"
]

LOVES = [
    "der Code auf Anhieb läuft",
    "das Essen perfekt wird",
    "die Sonne scheint",
    "alles nach Plan läuft",
    "ich Zeit für mich habe"
]

WEATHER = [
    "Sonnenschein", "Regen", "Schnee", "Wind", "Nebel",
    "Wolken", "Gewitter", "Herbstwetter", "Frühlingswetter"
]

FOOD = [
    "Pizza", "Pasta", "Salat", "Suppe", "Curry",
    "Kuchen", "Cookies", "Smoothie", "Sandwich", "Burger"
]

PROJECTS = [
    "Website-Redesign", "Mobile App", "Blog", "Podcast",
    "YouTube Channel", "Open Source Projekt", "Portfolio"
]

MEMORIES = [
    "letztem Sommer", "dem Urlaub", "dem Konzert",
    "der Schulzeit", "dem ersten Job", "der Uni-Zeit"
]

SURPRISES = [
    "es schon Freitag ist", "ich das vergessen hatte",
    "das so schnell ging", "es so einfach war",
    "es wirklich funktioniert hat"
]

VISIBILITY_OPTIONS = ["public", "friends", "close_friends", "family", "private"]


def login(username: str, password: str) -> str:
    """Login and return access token"""
    print(f"🔐 Logging in as {username}...")

    response = requests.post(
        f"{API_BASE}/auth/login",
        data={"username": username, "password": password}
    )

    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"✅ Login successful for {username}")
        return token
    else:
        print(f"❌ Login failed for {username}: {response.text}")
        return None


def generate_post_content() -> tuple[str, list[str]]:
    """Generate random post content with hashtags"""

    # Wähle Template
    template = random.choice(POST_TEMPLATES)

    # Ersetze Platzhalter
    content = template.format(
        activity=random.choice(ACTIVITIES),
        emotion=random.choice(EMOTIONS),
        topic=random.choice(TOPICS),
        opinion=random.choice(OPINIONS),
        situation=random.choice(SITUATIONS),
        question=random.choice(QUESTIONS),
        reminder=random.choice(REMINDERS),
        plottwist=random.choice(PLOTTWISTS),
        funfact=random.choice(FUNFACTS),
        unpopular=random.choice(UNPOPULAR),
        love=random.choice(LOVES),
        weather=random.choice(WEATHER),
        food=random.choice(FOOD),
        project=random.choice(PROJECTS),
        memory=random.choice(MEMORIES),
        surprise=random.choice(SURPRISES),
        hashtags=""  # Wird später hinzugefügt
    )

    # Wähle 2-5 zufällige Hashtags
    num_hashtags = random.randint(2, 5)
    selected_hashtags = random.sample(HASHTAGS, num_hashtags)

    # Füge Hashtags zum Content hinzu
    content = content.replace(" {hashtags}", "")  # Remove placeholder
    content = f"{content} {' '.join(selected_hashtags)}"

    return content, selected_hashtags


def create_post(token: str, content: str, visibility: str) -> bool:
    """Create a post"""

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    data = {
        "content": content,
        "visibility": visibility
    }

    response = requests.post(
        f"{API_BASE}/posts",
        headers=headers,
        json=data
    )

    return response.status_code in [200, 201]


def create_posts_for_user(username: str, password: str, count: int):
    """Create posts for a single user"""

    # Login
    token = login(username, password)
    if not token:
        return

    print(f"\n📝 Creating {count} posts for {username}...")

    successful = 0
    failed = 0

    for i in range(count):
        # Generate content
        content, hashtags = generate_post_content()

        # Random visibility
        visibility = random.choice(VISIBILITY_OPTIONS)

        # Create post
        if create_post(token, content, visibility):
            successful += 1
            if (i + 1) % 50 == 0:
                print(f"  ✅ {i + 1}/{count} posts created...")
        else:
            failed += 1
            print(f"  ❌ Failed to create post {i + 1}")

        # Small delay to avoid rate limiting
        time.sleep(0.1)

    print(f"\n✅ Finished for {username}:")
    print(f"   Successful: {successful}")
    print(f"   Failed: {failed}")


def main():
    """Main function"""

    print("=" * 60)
    print("🚀 SafeSpace Test Post Generator")
    print("=" * 60)
    print(f"\nCreating {POSTS_PER_USER} posts for each of {len(USERS)} users")
    print(f"Total posts: {POSTS_PER_USER * len(USERS)}")
    print()

    start_time = time.time()

    for user in USERS:
        create_posts_for_user(user["username"], user["password"], POSTS_PER_USER)
        print()

    end_time = time.time()
    duration = end_time - start_time

    print("=" * 60)
    print(f"✅ All done in {duration:.2f} seconds!")
    print("=" * 60)


if __name__ == "__main__":
    main()
