#!/usr/bin/env python3
"""
Script to create test users with random names and relationships
"""
import requests
import random
import time
from typing import List, Dict, Tuple

API_BASE = "http://localhost:8000/api"
PASSWORD = "Test123"
NUM_USERS = 500

# Deutsche Vornamen
FIRST_NAMES = [
    "Anna", "Ben", "Clara", "David", "Emma", "Felix", "Hannah", "Jonas",
    "Lena", "Max", "Nina", "Paul", "Sarah", "Tim", "Laura", "Lukas",
    "Marie", "Leon", "Sophie", "Tom", "Lisa", "Noah", "Mia", "Finn",
    "Julia", "Jan", "Lea", "Moritz", "Lara", "Simon", "Amelie", "Erik",
    "Charlotte", "Niklas", "Emily", "Philipp", "Michelle", "Daniel", "Vanessa",
    "Kevin", "Jennifer", "Sebastian", "Jessica", "Michael", "Sandra", "Andreas",
    "Katharina", "Florian", "Christina", "Tobias", "Stefanie", "Patrick", "Melanie",
    "Marco", "Nicole", "Alexander", "Sabrina", "Christian", "Jasmin", "Stefan",
    "Tanja", "Martin", "Diana", "Thomas", "Nadine", "Fabian", "Franziska",
    "Marcel", "Isabel", "Dennis", "Verena", "Matthias", "Annika", "Oliver",
    "Bianca", "Robin", "Carina", "Dominik", "Elena", "Adrian", "Svenja",
    "Julian", "Marina", "Markus", "Tatjana", "Christopher", "Ramona", "Benedikt",
    "Daniela", "Maximilian", "Manuela", "Johannes", "Monika", "Samuel", "Petra",
    "Benjamin", "Susanne", "Elias", "Andrea", "Anton", "Claudia", "Jakob",
    "Simone", "Konstantin", "Kerstin", "Valentin", "Silke", "Lorenz", "Ute"
]

LAST_NAMES = [
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner",
    "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter",
    "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun",
    "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz",
    "Krause", "Meier", "Lehmann", "Schmid", "Schulze", "Maier", "Köhler",
    "Herrmann", "König", "Walter", "Mayer", "Huber", "Kaiser", "Fuchs",
    "Peters", "Lang", "Scholz", "Möller", "Weiß", "Jung", "Hahn", "Schubert",
    "Vogel", "Friedrich", "Keller", "Günther", "Frank", "Berger", "Winkler",
    "Roth", "Beck", "Lorenz", "Baumann", "Franke", "Albrecht", "Schuster",
    "Simon", "Ludwig", "Böhm", "Winter", "Kraus", "Martin", "Schumacher",
    "Krämer", "Vogt", "Stein", "Jäger", "Otto", "Sommer", "Groß", "Seidel",
    "Heinrich", "Brandt", "Haas", "Schreiber", "Graf", "Schulte", "Dietrich",
    "Ziegler", "Kuhn", "Kühn", "Pohl", "Engels", "Horn", "Busch", "Bergmann",
    "Thomas", "Voigt", "Sauer", "Arnold", "Wolff", "Pfeiffer"
]

RELATION_TYPES = ["friend", "close_friend", "family", "acquaintance"]

# Statistiken
stats = {
    "users_created": 0,
    "users_failed": 0,
    "friendships_created": 0,
    "friendships_failed": 0
}

def generate_username(first_name: str, last_name: str, number: int) -> str:
    """Generate a unique username"""
    # Verschiedene Patterns für Usernamen
    patterns = [
        f"{first_name.lower()}{last_name.lower()}{number}",
        f"{first_name.lower()}.{last_name.lower()}{number}",
        f"{first_name.lower()}_{last_name.lower()}{number}",
        f"{first_name.lower()}{number}",
        f"{last_name.lower()}{first_name.lower()}{number}",
    ]
    return random.choice(patterns)


def generate_email(username: str) -> str:
    """Generate email address"""
    domains = ["gmail.com", "outlook.com", "yahoo.com", "web.de", "gmx.de"]
    return f"{username}@{random.choice(domains)}"


def register_user(username: str, email: str, first_name: str, last_name: str) -> Dict:
    """Register a new user"""
    try:
        response = requests.post(
            f"{API_BASE}/auth/register",
            json={
                "username": username,
                "email": email,
                "password": PASSWORD,
                "first_name": first_name,
                "last_name": last_name
            }
        )

        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "username": username,
                "token": data["access_token"]
            }
        else:
            return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


def login_user(username: str) -> str:
    """Login user and return token"""
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            data={"username": username, "password": PASSWORD}
        )

        if response.status_code == 200:
            return response.json()["access_token"]
        return None
    except:
        return None


def get_user_uid(token: str) -> int:
    """Get user UID from token"""
    try:
        response = requests.get(
            f"{API_BASE}/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        if response.status_code == 200:
            return response.json()["uid"]
        return None
    except:
        return None


def send_friend_request(from_token: str, to_uid: int, relation_type: str) -> Tuple[bool, str]:
    """Send friend request"""
    try:
        response = requests.post(
            f"{API_BASE}/friends/request",
            headers={"Authorization": f"Bearer {from_token}"},
            json={"target_uid": to_uid, "relation_type": relation_type}
        )
        if response.status_code in [200, 201]:
            return True, ""
        else:
            return False, f"Status {response.status_code}: {response.text[:100]}"
    except Exception as e:
        return False, str(e)


def accept_friend_request(token: str, from_uid: int) -> Tuple[bool, str]:
    """Accept friend request"""
    try:
        # Accept endpoint uses path parameter, not JSON body
        response = requests.post(
            f"{API_BASE}/friends/accept/{from_uid}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code in [200, 201]:
            return True, ""
        else:
            return False, f"Status {response.status_code}: {response.text[:100]}"
    except Exception as e:
        return False, str(e)


def create_users(count: int) -> List[Dict]:
    """Create multiple users"""
    print(f"🔨 Creating {count} users...")
    users = []

    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        username = generate_username(first_name, last_name, i + 1)
        email = generate_email(username)

        result = register_user(username, email, first_name, last_name)

        if result["success"]:
            # Get UID
            uid = get_user_uid(result["token"])
            users.append({
                "username": username,
                "token": result["token"],
                "uid": uid,
                "first_name": first_name,
                "last_name": last_name
            })
            stats["users_created"] += 1

            if (i + 1) % 50 == 0:
                print(f"  ✅ {i + 1}/{count} users created")
        else:
            stats["users_failed"] += 1
            if (i + 1) % 50 == 0:
                print(f"  ⚠️  {i + 1}/{count} processed ({stats['users_failed']} failed)")

        # Small delay to avoid rate limiting
        time.sleep(0.05)

    print(f"✅ User creation complete: {stats['users_created']} created, {stats['users_failed']} failed")
    return users


def create_friendships(users: List[Dict], friendships_per_user: int = 10):
    """Create random friendships between users"""
    print(f"\n🤝 Creating friendships ({friendships_per_user} per user on average)...")

    total_friendships = 0
    error_samples = []

    for i, user in enumerate(users):
        # Zufällige Anzahl an Freundschaften (5-20)
        num_friends = random.randint(5, min(20, len(users) - 1))

        # Wähle zufällige andere User
        potential_friends = [u for u in users if u["uid"] != user["uid"]]
        friends = random.sample(potential_friends, min(num_friends, len(potential_friends)))

        for friend in friends:
            # Zufälliger Beziehungstyp
            relation_type = random.choice(RELATION_TYPES)

            # Sende Freundschaftsanfrage
            success, error = send_friend_request(user["token"], friend["uid"], relation_type)
            if success:
                # Akzeptiere Freundschaftsanfrage
                success2, error2 = accept_friend_request(friend["token"], user["uid"])
                if success2:
                    stats["friendships_created"] += 1
                    total_friendships += 1
                else:
                    stats["friendships_failed"] += 1
                    if len(error_samples) < 3:
                        error_samples.append(f"Accept failed: {error2}")
            else:
                stats["friendships_failed"] += 1
                if len(error_samples) < 3:
                    error_samples.append(f"Request failed: {error}")

            # Small delay
            time.sleep(0.02)

        if (i + 1) % 50 == 0:
            print(f"  ✅ {i + 1}/{len(users)} users processed, {total_friendships} friendships created")

    print(f"✅ Friendships complete: {stats['friendships_created']} created, {stats['friendships_failed']} failed")

    if error_samples:
        print(f"\n⚠️  Sample errors:")
        for err in error_samples:
            print(f"   {err}")


def main():
    """Main function"""
    print("=" * 70)
    print("🚀 SafeSpace Test User & Relationship Generator")
    print("=" * 70)
    print(f"\nConfiguration:")
    print(f"  Users to create: {NUM_USERS}")
    print(f"  Password for all: {PASSWORD}")
    print(f"  Relation types: {', '.join(RELATION_TYPES)}")
    print()

    start_time = time.time()

    # Create users
    users = create_users(NUM_USERS)

    if not users:
        print("❌ No users created, aborting!")
        return

    print(f"\n📊 Created {len(users)} users successfully")
    print(f"   Sample users:")
    for user in users[:5]:
        print(f"   - {user['username']} ({user['first_name']} {user['last_name']}) [UID: {user['uid']}]")

    # Create friendships
    create_friendships(users)

    end_time = time.time()
    duration = end_time - start_time

    print("\n" + "=" * 70)
    print(f"✅ All done in {duration:.2f} seconds!")
    print(f"\nStatistics:")
    print(f"  Users created:      {stats['users_created']}")
    print(f"  Users failed:       {stats['users_failed']}")
    print(f"  Friendships:        {stats['friendships_created']}")
    print(f"  Friendship errors:  {stats['friendships_failed']}")
    print("=" * 70)

    # Save usernames to file
    with open("./test_users.txt", "w") as f:
        f.write("# Test Users - Username | Password\n")
        f.write("# All passwords are: Test123\n\n")
        for user in users:
            f.write(f"{user['username']}\n")

    print(f"\n📝 Usernames saved to: test_users.txt")


if __name__ == "__main__":
    main()
