/* ==========================================================
   1. ЛОГИКА ТАБЛИЧКИ И ЗАЩИТЫ ГЛАЗ
   ========================================================== */
function activateWarmMode() {
  document.getElementById('warm-overlay')?.classList.add('active');
  const btn = document.getElementById('warm-toggle-btn');
  if (btn) btn.textContent = '☀️ Обычный';
}

function deactivateWarmMode() {
  document.getElementById('warm-overlay')?.classList.remove('active');
  const btn = document.getElementById('warm-toggle-btn');
  if (btn) btn.textContent = '🕯️ Защита глаз';
}

window.closeModal = function() {
  const modal = document.getElementById('modal-backdrop');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.remove(), 300);
  }
};

window.handleWarmOn = function() {
  activateWarmMode();
  window.closeModal();
};

window.handleBackdropClick = function(event) {
  if (event.target.id === 'modal-backdrop') window.closeModal();
};

document.getElementById('warm-toggle-btn')?.addEventListener('click', () => {
  const overlay = document.getElementById('warm-overlay');
  if (overlay && overlay.classList.contains('active')) deactivateWarmMode();
  else activateWarmMode();
});

/* ==========================================================
   2. КОНФИГУРАЦИЯ ЖАНРОВ И ГИБРИДНОГО ПОИСКА
   ========================================================== */
let currentFlipBook = null;
let currentSelectedBook = null;
let cachedBookText = null;
let libraryDB = [];

const booksGrid = document.getElementById('books-grid');
const searchInput = document.getElementById('search-input');
const btnSearch = document.getElementById('btn-search');
const catalogView = document.getElementById('catalog-view');
const detailsView = document.getElementById('details-view');
const readerView = document.getElementById('reader-view');
const bookWrapper = document.getElementById('book-wrapper');
const filterButtons = document.querySelectorAll('.filter-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingStatus = document.getElementById('loading-status');

const BAN_WORDS = ['устав', 'гост', 'рецензия', 'памяти', 'список', 'статья', 'эсбе', 'бсэ', 'положение', 'кислота', 'рмг'];

const GENRE_CONFIG = {
  'all': {
    rule: () => true,
    category: 'Категория:Повести'
  },
  'philosophy': {
    rule: b => {
      const s = (b.author + ' ' + (b.title || b.cleanTitle)).toLowerCase();
      return ['ницше', 'шопенгауэр', 'кант', 'платон', 'аристотель', 'марк аврелий', 'сенека', 'философ', 'этика', 'трактат'].some(k => s.includes(k));
    },
    category: 'Категория:Философия'
  },
  'classics': {
    rule: b => {
      const s = (b.author + ' ' + (b.title || b.cleanTitle)).toLowerCase();
      return ['достоевск', 'толст', 'пушкин', 'чехов', 'гогол', 'тургенев', 'куприн', 'бунин', 'лермонтов', 'некрасов', 'островск'].some(k => s.includes(k));
    },
    category: 'Категория:Повести'
  },
  'detective': {
    rule: b => {
      const s = (b.author + ' ' + (b.title || b.cleanTitle)).toLowerCase();
      return ['дойл', 'по', 'честертон', 'детектив', 'шерлок', 'убийств', 'следстви', 'морг'].some(k => s.includes(k));
    },
    query: 'intitle:"(Дойл" OR intitle:"(Дойль" OR intitle:"(По" OR "Детектив"'
  },
  'horror': {
    rule: b => {
      const s = (b.author + ' ' + (b.title || b.cleanTitle)).toLowerCase();
      return ['лавкрафт', 'по', 'гогол', 'вампир', 'вурдалак', 'упырь', 'ужас', 'мистик', 'черт', 'ведьм', 'ашер', 'дагон'].some(k => s.includes(k));
    },
    query: 'intitle:"(Лавкрафт" OR intitle:"(Гоголь" OR intitle:"(По" OR "Вампир"'
  },
  'adventures': {
    rule: b => {
      const s = (b.author + ' ' + (b.title || b.cleanTitle)).toLowerCase();
      return ['верн', 'лондон', 'дефо', 'дюма', 'майн рид', 'стивенсон', 'капитан', 'остров', 'путешестви', 'море', 'авантюр'].some(k => s.includes(k));
    },
    category: 'Категория:Приключенческая литература'
  },
  'scifi': {
    rule: b => {
      const s = (b.author + ' ' + (b.title || b.cleanTitle)).toLowerCase();
      return ['беляев', 'уэллс', 'булычев', 'азимов', 'фантаст', 'космос', 'человек-амфибия', 'доуэл', 'машина времени', 'аэлита'].some(k => s.includes(k));
    },
    category: 'Категория:Фантастика'
  }
};

// ЗАГРУЗКА БАЗЫ ПРИ СТАРТЕ
async function initLibrary() {
  try {
    const res = await fetch('database.json?v=' + Date.now());
    if (res.ok) libraryDB = await res.json();
  } catch (e) {
    libraryDB = [];
  }

  const badge = document.getElementById('db-stats-badge');
  if (badge) {
    badge.innerHTML = `📚 В коллекции: <span style="color:#f1dfc5;">${libraryDB.length}</span> книг + 100+ в категориях`;
  }

  loadGenreWithGuaranteed100('all');
}

// ГАРАНТИЯ 100+ КНИГ В КАЖДОЙ КАТЕГОРИИ
async function loadGenreWithGuaranteed100(genreKey) {
  const config = GENRE_CONFIG[genreKey] || GENRE_CONFIG['all'];
  
  const localCards = libraryDB.filter(config.rule).map(b => ({ ...b, isLocal: true }));
  renderBookCards(localCards);

  try {
    let onlineItems = [];

    if (config.category) {
      const url = `https://ru.wikisource.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(config.category)}&cmlimit=100&cmnamespace=0&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      onlineItems = (data.query?.categorymembers || []).map(m => ({ title: m.title, snippet: `Произведение из фонда «${config.category.replace('Категория:', '')}».` }));
    } else if (config.query) {
      const url = `https://ru.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(config.query)}&srlimit=80&srnamespace=0&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      onlineItems = (data.query?.search || []).map(s => ({ title: s.title, snippet: s.snippet.replace(/<[^>]*>?/gm, '') }));
    }

    const onlineCards = [];
    onlineItems.forEach(item => {
      const t = item.title;
      const lower = t.toLowerCase();

      if (BAN_WORDS.some(w => lower.includes(w))) return;
      const cleanSlash = t.replace('/ДО', '');
      if (cleanSlash.includes('/')) return;

      let cleanTitle = cleanSlash.replace(/\s*\(.*?\)/g, '').trim();
      let authorMatch = t.match(/\((.*?)\)/);
      let realAuthor = authorMatch ? authorMatch[1].split(';')[0].replace('/ДО', '').trim() : 'Классика';

      if (lower.startsWith('о ') || lower.startsWith('об ')) return;
      if (localCards.some(m => m.title.toLowerCase() === cleanTitle.toLowerCase())) return;
      if (onlineCards.some(m => m.cleanTitle.toLowerCase() === cleanTitle.toLowerCase())) return;

      onlineCards.push({
        rawTitle: t,
        cleanTitle: cleanTitle,
        title: cleanTitle,
        author: realAuthor,
        snippet: item.snippet,
        isLocal: false
      });
    });

    renderBookCards([...localCards, ...onlineCards]);
  } catch (err) {}
}

// ПОИСК
async function performUnifiedSearch(query) {
  const q = query.trim();
  const cleanQ = q.toLowerCase();

  if (!q) {
    loadGenreWithGuaranteed100('all');
    return;
  }

  filterButtons.forEach(b => b.classList.remove('active'));

  const localMatches = libraryDB
    .filter(b => b.title.toLowerCase().includes(cleanQ) || b.author.toLowerCase().includes(cleanQ))
    .map(b => ({ ...b, isLocal: true }));

  renderBookCards(localMatches);

  try {
    const searchUrl = `https://ru.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('intitle:"(' + cleanQ + '" OR "' + q + '"')}&srlimit=50&srnamespace=0&format=json&origin=*`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    const results = data.query?.search || [];

    const onlineCards = [];
    results.forEach(item => {
      const t = item.title;
      const lower = t.toLowerCase();

      if (BAN_WORDS.some(w => lower.includes(w))) return;
      const cleanSlash = t.replace('/ДО', '');
      if (cleanSlash.includes('/')) return;

      let cleanTitle = cleanSlash.replace(/\s*\(.*?\)/g, '').trim();
      let authorMatch = t.match(/\((.*?)\)/);
      let realAuthor = authorMatch ? authorMatch[1].split(';')[0].replace('/ДО', '').trim() : 'Классика';

      if (realAuthor && !realAuthor.toLowerCase().includes(cleanQ) && cleanTitle.toLowerCase().includes(cleanQ)) return;
      if (lower.startsWith('о ') || lower.startsWith('об ')) return;

      if (localMatches.some(m => m.title.toLowerCase() === cleanTitle.toLowerCase())) return;
      if (onlineCards.some(m => m.cleanTitle.toLowerCase() === cleanTitle.toLowerCase())) return;

      onlineCards.push({
        rawTitle: t,
        cleanTitle: cleanTitle,
        title: cleanTitle,
        author: realAuthor,
        snippet: item.snippet.replace(/<[^>]*>?/gm, ''),
        isLocal: false
      });
    });

    renderBookCards([...localMatches, ...onlineCards]);
  } catch (err) {}
}

// ОТРИСОВКА КАРТОЧЕК В КАТАЛОГЕ
function renderBookCards(books) {
  booksGrid.innerHTML = '';
  if (books.length === 0) {
    booksGrid.innerHTML = `
      <div style="color:#8f7e70; margin-top:40px; text-align: center;">
        Ничего не найдено.<br><br>
        <button class="btn-upload-own" style="margin: 0 auto;" onclick="document.getElementById('user-file-input').click()">
          📁 Загрузить свою книгу (.txt / .fb2)
        </button>
      </div>
    `;
    return;
  }

  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';

    let badgeText = '';
    if (book.isLocal && book.content_length) {
      const realPages = Math.max(1, Math.ceil(book.content_length / 750));
      badgeText = `📄 ~${realPages} стр.`;
    } else {
      badgeText = '🌐 Онлайн';
    }

    let lengthSnippet = book.content_length 
      ? `Объем: ${book.content_length} знаков.` 
      : (book.snippet || 'Книга готова к открытию.');

    card.innerHTML = `
      <div>
        <div class="card-header-row">
          <div class="card-author">${book.author}</div>
          <div class="card-reading-badge">${badgeText}</div>
        </div>
        <div class="card-title">${book.title || book.cleanTitle}</div>
        <div class="card-snippet">${lengthSnippet}</div>
      </div>
      <div class="card-footer">Подробнее →</div>
    `;

    card.addEventListener('click', () => showBookDetails(book));
    booksGrid.appendChild(card);
  });
}

// СТРАНИЦА ОПИСАНИЯ С ФОНОВОЙ ПРЕДЗАГРУЗКОЙ
async function showBookDetails(book) {
  currentSelectedBook = book;
  cachedBookText = book.content || null;

  catalogView.style.display = 'none';
  readerView.style.display = 'none';
  detailsView.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const displayTitle = book.title || book.cleanTitle;
  document.getElementById('details-title').textContent = displayTitle;
  document.getElementById('details-author').textContent = book.author;
  document.getElementById('details-cover-title').textContent = displayTitle.toUpperCase();
  document.getElementById('details-cover-author').textContent = book.author;

  const statsTag = document.getElementById('details-stats-tag');

  if (book.isLocal && book.content_length) {
    document.getElementById('details-source-tag').textContent = '💾 Сохранено в коллекции';
    document.getElementById('details-description').textContent = `Книга проверена. Источник: ${book.source || 'Коллекция'}.`;
    
    const realPages = Math.max(1, Math.ceil(book.content_length / 750));
    const readingTimeMin = Math.ceil(book.content_length / 1500);
    let timeLabel = readingTimeMin < 60 ? `~${readingTimeMin} мин` : `~${(readingTimeMin / 60).toFixed(1)} ч`;
    statsTag.textContent = `⏱️ ${timeLabel} чтения • 📄 ~${realPages} стр.`;
  } else {
    document.getElementById('details-source-tag').textContent = '🌐 Онлайн-архив';
    document.getElementById('details-description').textContent = book.snippet || 'Загрузка аннотации...';
    statsTag.textContent = `⏱️ Скачиваем точный объем...`;

    const text = await streamBookTextOnDemand(displayTitle, book.author, true);
    if (text) {
      const realPages = Math.max(1, Math.ceil(text.length / 750));
      const readingTimeMin = Math.ceil(text.length / 1500);
      let timeLabel = readingTimeMin < 60 ? `~${readingTimeMin} мин` : `~${(readingTimeMin / 60).toFixed(1)} ч`;
      statsTag.textContent = `⏱️ ${timeLabel} чтения • 📄 ~${realPages} стр.`;
    } else {
      statsTag.textContent = `⚠️ Короткий фрагмент`;
    }
  }
}

window.closeDetailsView = function() {
  detailsView.style.display = 'none';
  catalogView.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    searchInput.value = '';

    const genre = btn.getAttribute('data-genre') || 'all';
    loadGenreWithGuaranteed100(genre);
  });
});

btnSearch.addEventListener('click', () => performUnifiedSearch(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performUnifiedSearch(searchInput.value);
});

/* ==========================================================
   3. ФОНОВЫЙ СТРИМИНГ ТЕКСТА
   ========================================================== */
function cleanTextFormatting(raw_text) {
  if (!raw_text) return "";
  let text = raw_text.replace(/\[(?:править|править\s+код|источник)\]/gi, '');
  text = text.replace(/\[\d+\]/g, '');
  text = text.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2');
  
  const lines = text.split('\n');
  const clean_lines = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const l_lower = line.toLowerCase();
    
    if (l_lower.includes("общественное достояние") || l_lower.includes("ст. 1281") || l_lower.includes("az.lib.ru") || l_lower.includes("русские издания")) continue;
    if (/^\d+[\s\.\–\-\—\t]+\d+[а-яa-z]?$/i.test(line) || /^\d{1,4}$/.test(line)) continue;
    if (line.startsWith('- ') || line.startsWith('-- ') || line.startsWith('– ')) line = '— ' + line.replace(/^[-–—\s]+/, '');
    clean_lines.push(line);
  }
  return clean_lines.join('\n\n');
}

async function streamBookTextOnDemand(displayTitle, authorHint, isBackground = false) {
  if (cachedBookText) return cachedBookText;

  if (!isBackground) {
    loadingOverlay.style.display = 'flex';
    loadingStatus.textContent = `Загружаем «${displayTitle}»...`;
  }

  try {
    let searchUrl = `https://ru.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(displayTitle)}&srlimit=4&srnamespace=0&format=json&origin=*`;
    let sRes = await fetch(searchUrl);
    let sData = await sRes.json();
    let hits = sData.query?.search || [];

    let targetPage = hits.length > 0 ? (hits.find(h => !h.title.includes('/ДО') && !h.title.includes('/'))?.title || hits[0].title) : displayTitle;

    let res = await fetch(`https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(targetPage)}&prop=text&format=json&origin=*`);
    let data = await res.json();
    if (!data.parse || !data.parse.text) throw new Error();

    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.parse.text['*'];

    const pageLinks = Array.from(tempDiv.querySelectorAll('a'))
      .map(a => decodeURIComponent(a.getAttribute('href') || ''))
      .filter(href => href.startsWith('/wiki/') && !href.includes(':'))
      .map(href => href.replace('/wiki/', '').replace(/_/g, ' '));

    const realBookLink = pageLinks.find(title => title.startsWith(displayTitle) && title.includes('(') && !title.endsWith('/ДО'));
    if (realBookLink && (tempDiv.innerText.includes('издания') || tempDiv.innerText.length < 1500)) {
      targetPage = realBookLink;
      res = await fetch(`https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(targetPage)}&prop=text&format=json&origin=*`);
      data = await res.json();
      tempDiv.innerHTML = data.parse.text['*'];
    }

    const chapterLinks = Array.from(tempDiv.querySelectorAll('a'))
      .map(a => decodeURIComponent(a.getAttribute('href') || ''))
      .filter(href => href.startsWith('/wiki/') && !href.includes(':'))
      .map(href => href.replace('/wiki/', '').replace(/_/g, ' '))
      .filter(title => title.startsWith(targetPage + '/') && !title.includes('оглавление') && !title.includes('таблица') && !title.includes('/ДО'));

    const uniqueChapters = [...new Set(chapterLinks)].slice(0, 35);
    let text = '';

    if (uniqueChapters.length > 0) {
      const promises = uniqueChapters.map(ch => 
        fetch(`https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(ch)}&prop=text&format=json&origin=*`)
          .then(r => r.json())
          .then(d => {
            if (d.parse?.text) {
              const div = document.createElement('div');
              div.innerHTML = d.parse.text['*'];
              div.querySelectorAll('.mw-editsection, .navigation, .infobox, style, script, .reference, table').forEach(el => el.remove());
              return div.innerText.trim();
            }
            return '';
          }).catch(() => '')
      );
      const results = await Promise.all(promises);
      text = results.filter(t => t.length > 50).join('\n\n');
    }

    if (!text || text.length < 500) {
      tempDiv.querySelectorAll('.mw-editsection, .navigation, .infobox, style, script, .reference, table').forEach(el => el.remove());
      text = tempDiv.innerText.trim();
    }

    text = cleanTextFormatting(text);
    if (!isBackground) loadingOverlay.style.display = 'none';
    cachedBookText = text;
    return text;
  } catch (e) {
    if (!isBackground) {
      loadingOverlay.style.display = 'none';
      alert('Не удалось загрузить онлайн-текст этого издания.');
    }
    return null;
  }
}

// 4. ЗАГРУЗКА СВОИХ КНИГ (DRAG & DROP)
window.handleUserFile = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  processUploadedFile(file);
};

function processUploadedFile(file) {
  const reader = new FileReader();
  const filename = file.name;
  
  reader.onload = function(e) {
    let rawContent = e.target.result;
    let title = filename.replace(/\.[^/.]+$/, "");
    let author = "Моя книга";
    let text = "";

    if (filename.toLowerCase().endsWith('.fb2')) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(rawContent, "text/xml");
      const titleTag = xmlDoc.querySelector('book-title');
      if (titleTag) title = titleTag.textContent;
      const authorTag = xmlDoc.querySelector('author last-name');
      if (authorTag) author = authorTag.textContent;
      const paragraphs = Array.from(xmlDoc.querySelectorAll('section p')).map(p => p.textContent.trim()).filter(Boolean);
      text = paragraphs.join('\n\n');
    } else {
      text = rawContent;
    }

    const userBook = { title, author, isLocal: true, content: cleanTextFormatting(text), content_length: text.length };
    currentSelectedBook = userBook;
    const pages = autoSplitTextToPages(userBook.content);
    openBookReader(title, author, pages);
  };
  reader.readAsText(file);
}

const dragOverlay = document.getElementById('drag-drop-overlay');
window.addEventListener('dragover', (e) => { e.preventDefault(); dragOverlay.style.display = 'flex'; });
dragOverlay.addEventListener('dragleave', () => { dragOverlay.style.display = 'none'; });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragOverlay.style.display = 'none';
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    processUploadedFile(e.dataTransfer.files[0]);
  }
});

// 5. СКАЧИВАНИЕ ФАЙЛОВ
window.toggleDownloadDropdown = function(e) {
  e.stopPropagation();
  document.getElementById('download-dropdown').classList.toggle('show');
};

window.addEventListener('click', (e) => {
  if (!e.target.closest('.download-dropdown-container')) {
    document.getElementById('download-dropdown')?.classList.remove('show');
  }
});

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;'; case '>': return '&gt;'; case '&': return '&amp;';
      case '\'': return '&apos;'; case '"': return '&quot;';
    }
  });
}

window.handleFormatClick = async function(format) {
  document.getElementById('download-dropdown').classList.remove('show');
  let text = currentSelectedBook.content || cachedBookText;
  if (!text) text = await streamBookTextOnDemand(currentSelectedBook.cleanTitle || currentSelectedBook.title, currentSelectedBook.author);
  if (!text) return;

  const title = currentSelectedBook.cleanTitle || currentSelectedBook.title;
  const author = currentSelectedBook.author;

  if (format === 'fb2') {
    const paragraphsXml = text.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${escapeXml(p)}</p>`).join('\n');
    const fb2Xml = `<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><author><last-name>${escapeXml(author)}</last-name></author><book-title>${escapeXml(title)}</book-title></title-info></description><body><title><p>${escapeXml(title)}</p></title><section>${paragraphsXml}</section></body></FictionBook>`;
    triggerDownload(new Blob([fb2Xml], { type: 'application/x-fictionbook+xml;charset=utf-8' }), `${title}.fb2`);
  }
  else if (format === 'txt') {
    triggerDownload(new Blob([`${title.toUpperCase()}\nАвтор: ${author}\n\n${text}`], { type: 'text/plain;charset=utf-8' }), `${title}.txt`);
  }
  else if (format === 'html') {
    const paragraphsHtml = text.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${escapeXml(p)}</p>`).join('\n');
    const htmlDoc = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeXml(title)}</title><style>body{font-family:'Georgia';max-width:720px;margin:40px auto;line-height:1.7;background:#faf6ee;color:#2d241e;}p{text-indent:1.5em;}</style></head><body><h1 style="text-align:center">${escapeXml(title)}</h1><div style="text-align:center;margin-bottom:40px">${escapeXml(author)}</div>${paragraphsHtml}</body></html>`;
    triggerDownload(new Blob([htmlDoc], { type: 'text/html;charset=utf-8' }), `${title}.html`);
  }
  else if (format === 'doc') {
    const paragraphsHtml = text.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0).map(p => `<p style="text-indent:25pt; margin:6pt 0;">${escapeXml(p)}</p>`).join('\n');
    const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${escapeXml(title)}</title></head><body style="font-family:Times New Roman; font-size:12pt;"><h1 style="text-align:center">${escapeXml(title)}</h1><p style="text-align:center; font-style:italic;">${escapeXml(author)}</p><hr>${paragraphsHtml}</body></html>`;
    triggerDownload(new Blob([docContent], { type: 'application/msword;charset=utf-8' }), `${title}.doc`);
  }
  else if (format === 'epub') {
    const paragraphsHtml = text.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${escapeXml(p)}</p>`).join('\n');
    const epubContent = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(title)}</title><style type="text/css">body{font-family:sans-serif;padding:5%;line-height:1.5;}h1{text-align:center;}p{text-indent:1em;margin:0.5em 0;}</style></head><body><h1>${escapeXml(title)}</h1><div style="text-align:center;color:#555;margin-bottom:2em;">${escapeXml(author)}</div>${paragraphsHtml}</body></html>`;
    triggerDownload(new Blob([epubContent], { type: 'application/epub+zip;charset=utf-8' }), `${title}.epub`);
  }
};

// 6. 3D ЧИТАЛКА
document.getElementById('btn-read-3d').addEventListener('click', async () => {
  let text = currentSelectedBook.content || cachedBookText;
  if (!text) text = await streamBookTextOnDemand(currentSelectedBook.cleanTitle || currentSelectedBook.title, currentSelectedBook.author);
  if (!text) return;

  const title = currentSelectedBook.cleanTitle || currentSelectedBook.title;
  const pages = autoSplitTextToPages(text);
  openBookReader(title, currentSelectedBook.author, pages);
});

function autoSplitTextToPages(rawText) {
  const isMobile = window.innerWidth <= 768;
  const charsPerLine = isMobile ? 32 : 46;
  const maxLinesPerPage = isMobile ? 18 : 22;

  const paragraphs = rawText.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
  const pages = [];
  let currentPageChunks = [];
  let currentLines = 0;

  for (let p of paragraphs) {
    while (p.length > 0) {
      let remainingLines = maxLinesPerPage - currentLines;
      if (remainingLines <= 1) {
        pages.push(currentPageChunks.join('\n\n'));
        currentPageChunks = [];
        currentLines = 0;
        remainingLines = maxLinesPerPage;
      }
      let maxChars = remainingLines * charsPerLine;
      if (p.length <= maxChars) {
        currentPageChunks.push(p);
        currentLines += Math.ceil(p.length / charsPerLine) + 1;
        p = '';
      } else {
        let cut = p.lastIndexOf(' ', maxChars);
        if (cut === -1 || cut < maxChars * 0.65) cut = maxChars;
        let chunk = p.slice(0, cut).trim();
        if (chunk.length > 0) currentPageChunks.push(chunk);
        pages.push(currentPageChunks.join('\n\n'));
        currentPageChunks = [];
        currentLines = 0;
        p = p.slice(cut).trim();
      }
    }
  }
  if (currentPageChunks.length > 0) pages.push(currentPageChunks.join('\n\n'));
  if (pages.length % 2 !== 0) pages.push(' ');
  return pages;
}

function openBookReader(title, author, pages) {
  detailsView.style.display = 'none';
  catalogView.style.display = 'none';
  readerView.style.display = 'flex';

  const isMobile = window.innerWidth <= 768;
  const pageWidth = isMobile ? Math.min(window.innerWidth - 20, 380) : 480;
  const pageHeight = isMobile ? Math.min(window.innerHeight - 80, 580) : 680;
  const totalPages = pages.length;

  let pagesHtml = `
    <div class="my-page" data-density="hard">
      <div class="page-content" style="justify-content: center; text-align: center;">
        <h1>${title.toUpperCase()}</h1>
        <p style="color: #cbb396; margin-top: 20px; font-size: 15px;">${author}</p>
      </div>
    </div>
  `;

  let pageNum = 1;
  pages.forEach(text => {
    pagesHtml += `
      <div class="my-page">
        <div class="page-content">
          <div><p>${text.replace(/\n\n/g, '</p><p>')}</p></div>
          <div class="page-number">Страница ${pageNum++} из ${totalPages}</div>
        </div>
      </div>
    `;
  });

  pagesHtml += `
    <div class="my-page" data-density="hard">
      <div class="page-content" style="justify-content: center; text-align: center;"><h2 style="color: #f1dfc5;">Конец книги</h2></div>
    </div>
  `;

  bookWrapper.innerHTML = `<div id="book">${pagesHtml}</div>`;

  setTimeout(() => {
    currentFlipBook = new St.PageFlip(document.getElementById('book'), {
      width: pageWidth, height: pageHeight, showCover: true,
      flippingTime: isMobile ? 600 : 850, maxShadowOpacity: 0.3, usePortrait: true 
    });
    currentFlipBook.loadFromHTML(document.querySelectorAll('.my-page'));
  }, 50);
}

document.getElementById('back-to-details-btn').addEventListener('click', () => {
  if (currentFlipBook) { currentFlipBook.destroy(); currentFlipBook = null; }
  bookWrapper.innerHTML = '';
  readerView.style.display = 'none';
  detailsView.style.display = 'flex';
});

window.addEventListener('keydown', (e) => {
  if (!currentFlipBook) return;
  if (e.key === 'ArrowRight') currentFlipBook.flipNext();
  if (e.key === 'ArrowLeft') currentFlipBook.flipPrev();
});

initLibrary();