

import requests

BASE_URL = "http://localhost:8000"

def get_interviews():
    r = requests.get(f"{BASE_URL}/interviews")
    print("GET /interviews:", r.json())

def add_interview():
    name = input("Interview name: ")
    audio_path = input("Path to audio file (mp3): ")
    try:
        with open(audio_path, "rb") as f:
            files = {"file": (audio_path.split("/")[-1], f)}
            data = {"name": name}
            r = requests.post(f"{BASE_URL}/interview", files=files, data=data)
            print("POST /interview:", r.json())
    except Exception as e:
        print(f"[ERROR] {e}")

def analyze_guilt():
    name = input("Interview name: ")
    data = {"name": name}
    r = requests.post(f"{BASE_URL}/analyze", data=data)
    print("POST /analyze:", r.json())

def delete_interview():
    name = input("Interview name to delete: ")
    r = requests.delete(f"{BASE_URL}/interview/{name}")
    print(f"DELETE /interview/{name}:", r.json())

def reset_interviews():
    r = requests.delete(f"{BASE_URL}/interviews/reset")
    print("DELETE /interviews/reset:", r.json())

def get_summary():
    r = requests.get(f"{BASE_URL}/summary")
    print("GET /summary:", r.json())

def menu():
    print("\n--- Murder-At-Midnight Backend Test CLI ---")
    print("1. Get all interviews")
    print("2. Add or update an interview")
    print("3. Analyze guilt level for an interview")
    print("4. Delete an interview by name")
    print("5. Delete all interviews and audio files (reset)")
    print("6. Get summary and ranking of suspects")
    print("0. Exit")

    choice = input("Select an option: ")
    return choice.strip()

if __name__ == "__main__":
    while True:
        choice = menu()
        if choice == "1":
            get_interviews()
        elif choice == "2":
            add_interview()
        elif choice == "3":
            analyze_guilt()
        elif choice == "4":
            delete_interview()
        elif choice == "5":
            reset_interviews()
        elif choice == "6":
            get_summary()
        elif choice == "0":
            print("Bye!")
            break
        else:
            print("Invalid option. Try again.")
