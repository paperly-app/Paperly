import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(script_dir, 'database.json')

print("📦 Упаковываем быструю базу для сайта...")

try:
    with open(db_path, 'r', encoding='utf-8') as f:
        full_database = json.load(f)

    print(f"📚 Всего книг в твоем архиве: {len(full_database)}")

    # Берем первые 25 главных книг (размер будет около 12 МБ)
    web_database = full_database[:25]

    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(web_database, f, ensure_ascii=False, indent=2)

    file_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"✅ ГОТОВО! Файл database.json ужат до {len(web_database)} книг (Размер: {file_size_mb:.1f} МБ).")
    print("🚀 Теперь он со свистом пролетит на GitHub через браузер!")

except FileNotFoundError:
    print("❌ Файл database.json не найден!")