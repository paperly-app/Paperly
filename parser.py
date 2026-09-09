import requests
from bs4 import BeautifulSoup
import json
import time
import urllib.parse
import re
import sys
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {
    'User-Agent': 'PaperlySpiderBot/10.0 (Educational Direct Link Crawler) requests/2.31'
}

session = requests.Session()
session.headers.update(HEADERS)

def sanitize_title(title):
    t = re.sub(r'[«»"\'„“”]', '', title)
    t = re.sub(r'\s*\(.*?\)', '', t)
    return t.strip()

def professional_text_editor(raw_text):
    if not raw_text:
        return ""
        
    text = re.sub(r'\[(?:править|править\s+код|источник|источник\s+не\s+указан)\]', '', raw_text, flags=re.I)
    text = re.sub(r'\[\d+\]', '', text)
    text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)
    
    lines = text.split('\n')
    clean_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        l_lower = line.lower()
        if any(b in l_lower for b in ["общественное достояние", "ст. 1281", "az.lib.ru", "таблица соответствия", "русские издания"]):
            continue
            
        if re.match(r'^\d+[\s\.\–\-\—\t]+\d+[а-яa-z]?$', line, re.I) or re.match(r'^\d{1,4}$', line):
            continue
            
        if line.startswith('- ') or line.startswith('-- ') or line.startswith('– '):
            line = '— ' + line.lstrip('-–— ')
            
        line = line.replace(' -- ', ' — ').replace(' - ', ' — ')
        clean_lines.append(line)
        
    return '\n\n'.join(clean_lines)

def get_json_safely(url, params=None):
    try:
        res = session.get(url, params=params, timeout=12)
        if res.status_code == 200:
            return res.json()
        return None
    except Exception:
        return None

def download_single_chapter(ch_title):
    try:
        params = {"action": "parse", "page": ch_title, "prop": "text", "format": "json"}
        res = session.get("https://ru.wikisource.org/w/api.php", params=params, timeout=10)
        data = res.json()
        if 'parse' in data:
            soup = BeautifulSoup(data['parse']['text']['*'], 'html.parser')
            for tag in soup(['table', 'script', 'style', 'nav', 'span', 'div.mw-editsection']):
                tag.decompose()
            return soup.get_text(separator='\n')
    except Exception:
        pass
    return ""

# ==========================================
# ИСТОЧНИК 1: ВИКИТЕКА (ПРЯМОЙ ДОСТУП БЕЗ ОШИБОК ПОИСКА!)
# ==========================================
def fetch_from_wikisource_direct(exact_page_name, clean_title):
    print("   [1] Викитека (wiki)........", end=" ", flush=True)
    
    # 1. СРАЗУ ИДЕМ ПО ТОЧНОМУ ИМЕНИ СТРАНИЦЫ
    parse_params = {"action": "parse", "page": exact_page_name, "prop": "text|links", "format": "json"}
    text_data = get_json_safely("https://ru.wikisource.org/w/api.php", params=parse_params)
    
    # Если прямого совпадения нет — пробуем резервный поиск
    if not text_data or 'parse' not in text_data:
        search_params = {"action": "query", "list": "search", "srsearch": clean_title, "srlimit": 1, "srnamespace": 0, "format": "json"}
        s_data = get_json_safely("https://ru.wikisource.org/w/api.php", params=search_params)
        if s_data and s_data.get('query', {}).get('search'):
            exact_page_name = s_data['query']['search'][0]['title']
            parse_params["page"] = exact_page_name
            text_data = get_json_safely("https://ru.wikisource.org/w/api.php", params=parse_params)

    if not text_data or 'parse' not in text_data:
        print("❌ Нет.")
        return ""
        
    soup = BeautifulSoup(text_data['parse']['text']['*'], 'html.parser')
    raw_text_check = soup.get_text()
    links = text_data['parse'].get('links', [])
    
    # Обход страницы со списком переводов
    if "Русские издания" in raw_text_check or len(raw_text_check) < 1200:
        for link_obj in links:
            l_title = link_obj['*']
            if clean_title in l_title and "(" in l_title and "ДО" not in l_title:
                exact_page_name = l_title
                parse_params["page"] = exact_page_name
                text_data = get_json_safely("https://ru.wikisource.org/w/api.php", params=parse_params)
                if text_data and 'parse' in text_data:
                    soup = BeautifulSoup(text_data['parse']['text']['*'], 'html.parser')
                    links = text_data['parse'].get('links', [])
                break

    # Скачивание глав
    subchapters = [l['*'] for l in links if l['*'].startswith(exact_page_name + '/') and 'ДО' not in l['*'] and 'оглавление' not in l['*'].lower() and 'таблица' not in l['*'].lower()]
    
    if len(subchapters) > 0:
        chapters_to_get = subchapters[:45]
        with ThreadPoolExecutor(max_workers=8) as executor:
            future_to_index = {executor.submit(download_single_chapter, ch): i for i, ch in enumerate(chapters_to_get)}
            results = [None] * len(chapters_to_get)
            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                results[idx] = future.result()
                
        full_text = '\n\n'.join(filter(None, results))
        text = professional_text_editor(full_text)
    else:
        for tag in soup(['table', 'script', 'style', 'nav', 'span', 'div.mw-editsection']):
            tag.decompose()
        text = professional_text_editor(soup.get_text(separator='\n'))
        
    print(f"✅ {len(text)} симв.")
    return text

# ==========================================
# ИСТОЧНИК 2: TULULU.ORG
# ==========================================
def fetch_from_tululu(clean_title):
    print("   [2] Tululu.org (ru)............", end=" ", flush=True)
    try:
        encoded_title = urllib.parse.quote(clean_title.encode('windows-1251', errors='ignore'))
        url = f"https://tululu.org/search/?q={encoded_title}"
        res = session.get(url, timeout=8)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        book_id = None
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('/b') and href.endswith('/') and href[2:-1].isdigit():
                book_id = href[2:-1]
                break
                
        if not book_id:
            print("❌ Нет.")
            return ""
            
        txt_res = session.get(f"https://tululu.org/txt.php?id={book_id}", timeout=10)
        raw_text = txt_res.content.decode('windows-1251', errors='ignore')
        text = professional_text_editor(raw_text)
        print(f"✅ {len(text)} симв.")
        return text
    except Exception:
        print("❌ Ошибка.")
        return ""

# ==========================================
# ИСТОЧНИК 3: LIB.RU (МОШКОВ)
# ==========================================
def fetch_from_moshkov(clean_title):
    print("   [3] Lib.ru (Мошков)............", end=" ", flush=True)
    try:
        encoded_title = urllib.parse.quote(clean_title.encode('koi8-r', errors='ignore'))
        url = f"http://lib.ru/cgi-bin/seek?find={encoded_title}"
        res = session.get(url, timeout=8)
        res.encoding = 'koi8-r'
        soup = BeautifulSoup(res.text, 'html.parser')
        
        txt_link = None
        for a in soup.find_all('a', href=True):
            href = a['href']
            if ".txt" in href or (len(href.split('/')) > 2 and href.endswith('.txt')):
                txt_link = "http://lib.ru" + href
                break
                
        if not txt_link:
            print("❌ Нет.")
            return ""
            
        txt_res = session.get(txt_link, timeout=10)
        txt_res.encoding = 'koi8-r'
        txt_soup = BeautifulSoup(txt_res.text, 'html.parser')
        pre = txt_soup.find('pre')
        raw_text = pre.get_text() if pre else txt_soup.get_text()
        text = professional_text_editor(raw_text)
        print(f"✅ {len(text)} симв.")
        return text
    except Exception:
        print("❌ Ошибка.")
        return ""

# ==========================================
# БИТВА ИСТОЧНИКОВ
# ==========================================
def hunt_for_best_book(book_dict):
    raw_title = book_dict['title']
    author = book_dict['author']
    exact_wiki_page = book_dict.get('search_query', raw_title)
    clean_title = sanitize_title(raw_title)

    print(f"\n=============================================")
    print(f"🕵️ ИЩУ: «{clean_title}» ({author})")
    print(f"=============================================")
    
    # 1. Прямой доступ к Викитеке
    text_wiki = fetch_from_wikisource_direct(exact_wiki_page, clean_title)
    # 2. Проверка альтернативных библиотек
    text_tululu = fetch_from_tululu(clean_title)
    text_moshkov = fetch_from_moshkov(clean_title)
    
    candidates = [
        ("Викитека", text_wiki),
        ("Tululu", text_tululu),
        ("Lib.ru (Мошков)", text_moshkov)
    ]
    
    valid_texts = [(name, text) for name, text in candidates if len(text) > 8000]
    
    if not valid_texts:
        print(f"⚠️ Текст слишком короткий (< 8к знаков). Пропускаем.")
        return None
        
    best_source, best_text = max(valid_texts, key=lambda x: len(x[1]))
    print(f"🏆 ПОБЕДИЛ: {best_source.upper()}! (Качественный текст: {len(best_text)} знаков)")
    
    return {
        "title": clean_title,
        "author": author,
        "source": best_source,
        "content_length": len(best_text),
        "content": best_text
    }

# ==========================================
# ПАУК-РАЗВЕДЧИК
# ==========================================
def build_parsing_queue():
    categories = [
        'Категория:Романы',
        'Категория:Повести',
        'Категория:Фантастика',
        'Категория:Детективы',
        'Категория:Приключенческая литература',
        'Категория:Драматургия',
        'Категория:Сказки'
    ]
    
    discovered_books = []
    print("\n🕸️ ПАУК СКАНИРУЕТ БИБЛИОТЕКИ...")
    
    for cat in categories:
        url = f"https://ru.wikisource.org/w/api.php?action=query&list=categorymembers&cmtitle={urllib.parse.quote(cat)}&cmlimit=500&cmnamespace=0&format=json"
        data = get_json_safely(url)
        if not data or 'query' not in data: continue
            
        members = data['query']['categorymembers']
        for m in members:
            raw_title = m['title']
            lower_t = raw_title.lower()
            
            if '/' in raw_title or 'о ' == lower_t[:2] or 'об ' == lower_t[:3]: continue
            if any(w in lower_t for w in ['устав', 'гост', 'рецензия', 'список', 'статья', 'отчет', 'указатель']): continue
                
            match = re.search(r'\((.*?)\)', raw_title)
            author = match.group(1).split(';')[0].replace('ДО', '').strip() if match else "Классика"
            clean_title = re.sub(r'\s*\(.*?\)', '', raw_title).strip()
            
            discovered_books.append({
                "title": clean_title,
                "author": author,
                "search_query": raw_title # ТОЧНЫЙ ПРЯМОЙ АДРЕС СТРАНИЦЫ
            })
            
    unique_books = []
    seen = set()
    for b in discovered_books:
        identifier = f"{sanitize_title(b['title']).lower()}_{b['author'].lower()}"
        if identifier not in seen:
            seen.add(identifier)
            unique_books.append(b)
            
    random.shuffle(unique_books)
    print(f"🎯 Отобрано {len(unique_books)} уникальных книг. Начинаем сбор!")
    return unique_books

# ==========================================
# ЗАПУСК
# ==========================================
if __name__ == "__main__":
    database = []
    try:
        with open('database.json', 'r', encoding='utf-8') as f:
            database = json.load(f)
            print(f"📥 Загружена текущая база: {len(database)} книг.")
    except Exception:
        print("📥 Создаем новую базу database.json...")

    existing_titles = [sanitize_title(b['title']).lower() for b in database]
    target_books = build_parsing_queue()
    
    print("\n🤖 ТУРБО-БОТ ЗАПУЩЕН! Нажми Ctrl+C в любой момент для сохранения.")
    print("==========================================================================")
    
    added = 0
    try:
        for req in target_books:
            clean_check = sanitize_title(req['title']).lower()
            if clean_check in existing_titles:
                continue
                
            book_data = hunt_for_best_book(req)
            if book_data:
                database.append(book_data)
                existing_titles.append(clean_check)
                added += 1
                
                if added % 2 == 0:
                    with open('database.json', 'w', encoding='utf-8') as f:
                        json.dump(database, f, ensure_ascii=False, indent=2)
                    print("💾 [БАЗА ОБНОВЛЕНА НА ДИСКЕ]")
                    
            time.sleep(0.3)
            
    except KeyboardInterrupt:
        print("\n\n🛑 ОСТАНОВКА! Сохраняю прогресс...")
    finally:
        with open('database.json', 'w', encoding='utf-8') as f:
            json.dump(database, f, ensure_ascii=False, indent=2)
        print(f"\n🎉 ГОТОВО! В базе теперь {len(database)} чистейших книг!")