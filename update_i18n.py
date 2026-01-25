#!/usr/bin/env python3
"""
Script to update i18n files with error messages
"""
import json
from pathlib import Path

i18n_dir = Path("/home/user/safespace-socialnetwork/frontend/src/assets/i18n")

# Translations for each language
translations = {
    "french.json": {
        "login_errors": {
            "invalidCredentials": "Identifiants invalides",
            "loginFailed": "Échec de la connexion. Veuillez réessayer."
        },
        "register_errors": {
            "usernameAlreadyRegistered": "Ce nom d'utilisateur est déjà pris. Veuillez en choisir un autre.",
            "emailAlreadyRegistered": "Cette adresse e-mail est déjà enregistrée. Veuillez en utiliser une autre ou vous connecter.",
            "passwordMismatch": "Les mots de passe ne correspondent pas",
            "registrationFailed": "Échec de l'inscription. Veuillez réessayer."
        },
        "register_success": "Inscription réussie! Redirection..."
    },
    "italian.json": {
        "login_errors": {
            "invalidCredentials": "Credenziali non valide",
            "loginFailed": "Accesso non riuscito. Riprova."
        },
        "register_errors": {
            "usernameAlreadyRegistered": "Questo nome utente è già in uso. Scegline un altro.",
            "emailAlreadyRegistered": "Questa email è già registrata. Usane un'altra o accedi.",
            "passwordMismatch": "Le password non corrispondono",
            "registrationFailed": "Registrazione non riuscita. Riprova."
        },
        "register_success": "Registrazione riuscita! Reindirizzamento..."
    },
    "arabic.json": {
        "login_errors": {
            "invalidCredentials": "بيانات اعتماد غير صحيحة",
            "loginFailed": "فشل تسجيل الدخول. يرجى المحاولة مرة أخرى."
        },
        "register_errors": {
            "usernameAlreadyRegistered": "اسم المستخدم هذا مستخدم بالفعل. الرجاء اختيار اسم آخر.",
            "emailAlreadyRegistered": "عنوان البريد الإلكتروني هذا مسجل بالفعل. الرجاء استخدام عنوان آخر أو تسجيل الدخول.",
            "passwordMismatch": "كلمات المرور غير متطابقة",
            "registrationFailed": "فشل التسجيل. يرجى المحاولة مرة أخرى."
        },
        "register_success": "التسجيل ناجح! إعادة التوجيه..."
    }
}

for filename, trans in translations.items():
    filepath = i18n_dir / filename

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Update login errors
    if "login" in data:
        data["login"]["errors"] = trans["login_errors"]

    # Update register errors and success
    if "register" in data:
        data["register"]["errors"] = trans["register_errors"]
        data["register"]["success"] = trans["register_success"]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Updated {filename}")

print("\n✅ All i18n files updated successfully!")
