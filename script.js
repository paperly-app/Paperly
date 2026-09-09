/* ==========================================================
   1. ЛОГИКА ТАБЛИЧКИ И ЗАЩИТЫ ГЛАЗ
   ========================================================== */
function activateWarmMode() {
  const overlay = document.getElementById('warm-overlay');
  const toggleBtn = document.getElementById('warm-toggle-btn');
  if (overlay) overlay.classList.add('active');
  if (toggleBtn) toggleBtn.textContent = '☀️ Обычный';
}

function deactivateWarmMode() {
  const overlay = document.getElementById('warm-overlay');
  const toggleBtn = document.getElementById('warm-toggle-btn');
  if (overlay) overlay.classList.remove('active');
  if (toggleBtn) toggleBtn.textContent = '🕯️ Защита глаз';
}

window.closeModal = function() {
  const modal = document.getElementById('modal-backdrop');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
};

window.handleWarmOn = function() {
  activateWarmMode();
  window.closeModal();
};

window.handleBackdropClick = function(event) {
  if (event.target.id === 'modal-backdrop') {
    window.closeModal();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('warm-toggle-btn');
  const overlay = document.getElementById('warm-overlay');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (overlay && overlay.classList.contains('active')) {
        deactivateWarmMode();
      } else {
        activateWarmMode();
      }
    });
  }
});


/* ==========================================================
   2. ГИБРИДНЫЙ ПОИСК: ВИКИПЕДИЯ (ОТБОР) + ВИКИТЕКА (ТЕКСТ)
   ========================================================== */
let currentFlipBook = null;
let currentSelectedBook = null;
let cachedBookText = null;

const booksGrid = document.getElementById('books-grid');
const searchInput = document.getElementById('search-input');
const btnSearch = document.getElementById('btn-search');
const catalogView = document.getElementById('catalog-view');
const detailsView = document.getElementById('details-view');
const readerView = document.getElementById('reader-view');
const bookWrapper = document.getElementById('book-wrapper');
const backToDetailsBtn = document.getElementById('back-to-details-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingStatus = document.getElementById('loading-status');
const filterButtons = document.querySelectorAll('.filter-btn');

// ПОИСК ШЕДЕВРОВ ЧЕРЕЗ РУССКУЮ ВИКИПЕДИЮ (ЗДЕСЬ ТОЛЬКО ЗНАЧИМЫЕ КНИГИ!)
async function searchViaWikipedia(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  filterButtons.forEach(b => b.classList.remove('active'));
  booksGrid.innerHTML = '<div style="color:#8f7e70; margin-top:40px;">Википедия отбирает подлинные литературные шедевры...</div>';

  try {
    // Делаем запрос в Википедию с фильтром по книгам и романам
    const wikiSearchQuery = `${cleanQuery} (роман OR повесть OR рассказ OR книга OR трагедия OR философия)`;
    const url = `https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wikiSearchQuery)}&srlimit=30&srnamespace=0&format=json&origin=*`;
    
    const res = await fetch(url);
    const data = await res.json();
    const results = data.query?.search || [];

    const finalCards = [];

    // Черный список чисто энциклопедических служебных статей
    const banList = ['библиография', 'экранизация', 'фильм', 'список персонажей', 'список произведений', 'дискография'];

    results.forEach(item => {
      const title = item.title;
      const lower = title.toLowerCase();

      // Пропускаем фильмы, списки и экранизации
      if (banList.some(b => lower.includes(b))) return;
      if (lower.startsWith('список ')) return;

      // Очищаем сниппет аннотации от HTML-тегов Википедии
      let cleanSnippet = item.snippet.replace(/<[^>]*>?/gm, '').trim();

      // Красиво чистим название (убираем уточнения вроде "(роман)", "(книга)")
      let cleanTitle = title.replace(/\s*\(.*?\)/g, '').trim();

      // Определяем автора: если искали автора, ставим его, иначе извлекаем
      let authorName = cleanQuery;
      if (authorName.length > 0) {
        authorName = authorName[0].toUpperCase() + authorName.slice(1);
      }

      if (!finalCards.some(c => c.cleanTitle.toLowerCase() === cleanTitle.toLowerCase())) {
        finalCards.push({
          rawTitle: title,            // Заголовок из Википедии
          cleanTitle: cleanTitle,      // Красивое чистое имя книги
          author: authorName,          // Автор
          snippet: cleanSnippet.length > 20 ? cleanSnippet + '...' : `Литературный шедевр, зафиксированный в энциклопедии Википедия.`
        });
      }
    });

    renderBookCards(finalCards);
  } catch (err) {
    booksGrid.innerHTML = '<div style="color:#c97a7a; margin-top:40px;">Ошибка подключения к Википедии. Проверьте интернет!</div>';
  }
}

// ЗАГРУЗКА ОФИЦИАЛЬНЫХ КАТЕГОРИЙ ВИКИТЕКИ
async function loadCategory(categoryTitle) {
  booksGrid.innerHTML = `<div style="color:#8f7e70; margin-top:40px;">Загружаем книги из «${categoryTitle.replace('Категория:', '')}»...</div>`;

  try {
    const url = `https://ru.wikisource.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(categoryTitle)}&cmlimit=50&cmnamespace=0&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const members = data.query?.categorymembers || [];

    const finalCards = [];
    const catName = categoryTitle.replace('Категория:', '');

    members.forEach(item => {
      const t = item.title;
      const cleanSlash = t.replace('/ДО', '');
      if (cleanSlash.includes('/')) return;

      let cleanTitle = cleanSlash.replace(/\s*\(.*?\)/g, '').trim();
      let authorMatch = t.match(/\((.*?)\)/);
      let authorHint = authorMatch ? authorMatch[1].split(';')[0].replace('/ДО', '').trim() : catName;

      if (!finalCards.some(c => c.cleanTitle.toLowerCase() === cleanTitle.toLowerCase())) {
        finalCards.push({
          rawTitle: t,
          cleanTitle: cleanTitle,
          author: authorHint,
          snippet: `Классическое произведение фонда «${catName}».`
        });
      }
    });

    renderBookCards(finalCards);
  } catch (err) {
    booksGrid.innerHTML = '<div style="color:#c97a7a; margin-top:40px;">Ошибка загрузки архива. Проверьте интернет!</div>';
  }
}

function renderBookCards(cards) {
  booksGrid.innerHTML = '';
  if (cards.length === 0) {
    booksGrid.innerHTML = '<div style="color:#8f7e70; margin-top:40px;">Шедевров не найдено. Попробуйте другой запрос!</div>';
    return;
  }

  cards.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';

    card.innerHTML = `
      <div>
        <div class="card-author">${book.author}</div>
        <div class="card-title">${book.cleanTitle}</div>
        <div class="card-snippet">${book.snippet}</div>
      </div>
      <div class="card-footer">Подробнее →</div>
    `;

    card.addEventListener('click', () => showBookDetails(book));
    booksGrid.appendChild(card);
  });
}

// СТРАНИЦА ОПИСАНИЯ КНИГИ
function showBookDetails(book) {
  currentSelectedBook = book;
  cachedBookText = null;

  catalogView.style.display = 'none';
  readerView.style.display = 'none';
  detailsView.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.getElementById('details-title').textContent = book.cleanTitle;
  document.getElementById('details-author').textContent = book.author;
  document.getElementById('details-description').textContent = book.snippet;

  document.getElementById('details-cover-title').textContent = book.cleanTitle.toUpperCase();
  document.getElementById('details-cover-author').textContent = book.author;
}

window.closeDetailsView = function() {
  detailsView.style.display = 'none';
  catalogView.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleDownloadDropdown = function(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('download-dropdown');
  dropdown.classList.toggle('show');
};

function closeDownloadDropdown() {
  const dropdown = document.getElementById('download-dropdown');
  if (dropdown) dropdown.classList.remove('show');
}

window.addEventListener('click', (e) => {
  if (!e.target.closest('.download-dropdown-container')) {
    closeDownloadDropdown();
  }
});

// СКАЧИВАНИЕ ТЕКСТА КНИГИ ИЗ ВИКИТЕКИ ПО НАЗВАНИЮ ИЗ ВИКИПЕДИИ
async function fetchCleanBookText(rawTitle, displayTitle) {
  if (cachedBookText) return cachedBookText;

  loadingOverlay.style.display = 'flex';
  loadingStatus.textContent = `Ищем текст «${displayTitle}» в библиотеке...`;

  try {
    // 1. Ищем точную страницу с текстом в архивах Викитеки
    let targetPage = rawTitle;

    const findUrl = `https://ru.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(displayTitle)}&srlimit=5&srnamespace=0&format=json&origin=*`;
    const findRes = await fetch(findUrl);
    const findData = await findRes.json();
    const hits = findData.query?.search || [];

    if (hits.length > 0) {
      // Ищем прямое совпадение с автором или первое совпадение
      const bestMatch = hits.find(h => !h.title.includes('/ДО') && !h.title.includes('/')) || hits[0];
      targetPage = bestMatch.title;
    }

    // 2. Скачиваем найденное произведение из Викитеки
    loadingStatus.textContent = `Скачиваем главы «${displayTitle}»...`;
    let res = await fetch(`https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(targetPage)}&prop=text|links&format=json&origin=*`);
    let data = await res.json();

    if (!data.parse || !data.parse.text) throw new Error();

    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.parse.text['*'];

    // Если попали на список переводов
    const pageLinks = Array.from(tempDiv.querySelectorAll('a'))
      .map(a => decodeURIComponent(a.getAttribute('href') || ''))
      .filter(href => href.startsWith('/wiki/') && !href.includes(':'))
      .map(href => href.replace('/wiki/', '').replace(/_/g, ' '));

    const realBookLink = pageLinks.find(title => 
      title.startsWith(displayTitle) && 
      title.includes('(') && 
      !title.endsWith('/ДО')
    );

    if (realBookLink && (tempDiv.innerText.includes('издания') || tempDiv.innerText.length < 1600)) {
      targetPage = realBookLink;
      res = await fetch(`https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(targetPage)}&prop=text|links&format=json&origin=*`);
      data = await res.json();
      tempDiv.innerHTML = data.parse.text['*'];
    }

    // Скачиваем главы, если книга разбита на подстраницы
    const chapterLinks = Array.from(tempDiv.querySelectorAll('a'))
      .map(a => decodeURIComponent(a.getAttribute('href') || ''))
      .filter(href => href.startsWith('/wiki/') && !href.includes(':'))
      .map(href => href.replace('/wiki/', '').replace(/_/g, ' '))
      .filter(title => {
        if (!title.startsWith(targetPage + '/')) return false;
        const lower = title.toLowerCase();
        return !lower.includes('/до') && 
               !lower.includes('содержание') && 
               !lower.includes('оглавление') && 
               !lower.includes('таблица соответствия') && 
               !lower.includes('соответствие страниц') && 
               !lower.includes('указатель') && 
               !lower.includes('примечания');
      });

    const uniqueChapters = [...new Set(chapterLinks)].slice(0, 30);
    let text = '';

    if (uniqueChapters.length > 0) {
      loadingStatus.textContent = `Качаем все главы книги (${uniqueChapters.length} глав)...`;

      const chapterPromises = uniqueChapters.map(ch => 
        fetch(`https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(ch)}&prop=text&format=json&origin=*`)
          .then(r => r.json())
          .then(d => {
            if (d.parse?.text) {
              const div = document.createElement('div');
              div.innerHTML = d.parse.text['*'];
              div.querySelectorAll(`
                .mw-editsection, .navigation, .infobox, style, script, .reference, .noprint,
                .licenseContainer, .boilerplate, .headerContainer, .headertemplate, .ws-noexport,
                .textinfo, .ws-summary, table, .toc, .pagelist, [id*="license"], [class*="license"], [id*="header"]
              `).forEach(el => el.remove());
              return div.innerText.trim();
            }
            return '';
          })
          .catch(() => '')
      );

      const loaded = await Promise.all(chapterPromises);
      text = loaded.filter(t => t.length > 50).join('\n\n');
    }

    if (!text || text.length < 500) {
      tempDiv.querySelectorAll(`
        .mw-editsection, .navigation, .infobox, style, script, .reference, .noprint,
        .licenseContainer, .boilerplate, .headerContainer, .headertemplate, .ws-noexport,
        .textinfo, .ws-summary, table, .toc, .pagelist, [id*="license"], [class*="license"], [id*="header"]
      `).forEach(el => el.remove());
      text = tempDiv.innerText.trim();
    }

    const lines = text.split(/\r?\n/);
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^\d+[\s\.\–\-\—\t]+\d+[а-яa-z]?$/i.test(trimmed)) return false;
      if (/^\d{1,4}$/.test(trimmed)) return false;

      const l = trimmed.toLowerCase();
      return !l.includes('общественное достояние') &&
             !l.includes('ст. 1281') &&
             !l.includes('авторского права') &&
             !l.includes('русские издания') &&
             !l.includes('az.lib.ru') &&
             !l.includes('источник:') &&
             !l.includes('опубл.:') &&
             !l.includes('перевод опубл') &&
             !l.includes('исключительного права') &&
             !l.includes('согласно ст.');
    });

    text = cleanLines.join('\n').trim();

    loadingOverlay.style.display = 'none';
    cachedBookText = text;
    return text;
  } catch (e) {
    loadingOverlay.style.display = 'none';
    alert('Не удалось загрузить полный текст этого издания из архива.');
    return null;
  }
}

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
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

// СКАЧИВАНИЕ ФАЙЛОВ
window.handleFormatClick = async function(format) {
  closeDownloadDropdown();
  if (!currentSelectedBook) return;

  const text = await fetchCleanBookText(currentSelectedBook.rawTitle, currentSelectedBook.cleanTitle);
  if (!text) return;

  const title = currentSelectedBook.cleanTitle;
  const author = currentSelectedBook.author;

  if (format === 'fb2') {
    const paragraphsXml = text.split(/\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${escapeXml(p)}</p>`)
      .join('\n');

    const fb2Xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info>
      <genre>prose_classic</genre>
      <author><last-name>${escapeXml(author)}</last-name></author>
      <book-title>${escapeXml(title)}</book-title>
      <lang>ru</lang>
    </title-info>
  </description>
  <body>
    <title><p>${escapeXml(title)}</p></title>
    <section>
      ${paragraphsXml}
    </section>
  </body>
</FictionBook>`;

    const blob = new Blob([fb2Xml], { type: 'application/x-fictionbook+xml;charset=utf-8' });
    triggerDownload(blob, `${title}.fb2`);
  }
  else if (format === 'txt') {
    const content = `${title.toUpperCase()}\nАвтор: ${author}\n\n${text}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `${title}.txt`);
  }
  else if (format === 'html') {
    const paragraphsHtml = text.split(/\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${escapeXml(p)}</p>`)
      .join('\n');

    const htmlDoc = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title)} — ${escapeXml(author)}</title>
  <style>
    body { font-family: 'Georgia', serif; max-width: 720px; margin: 40px auto; padding: 25px; line-height: 1.7; background: #faf6ee; color: #2d241e; }
    h1 { text-align: center; font-weight: normal; margin-bottom: 5px; }
    .author { text-align: center; color: #887; margin-bottom: 40px; font-style: italic; }
    p { margin: 1em 0; text-indent: 1.5em; }
  </style>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
  <div class="author">${escapeXml(author)}</div>
  ${paragraphsHtml}
</body>
</html>`;
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, `${title}.html`);
  }
  else if (format === 'doc') {
    const paragraphsHtml = text.split(/\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p style="text-indent:25pt; margin:6pt 0;">${escapeXml(p)}</p>`)
      .join('\n');

    const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${escapeXml(title)}</title></head>
<body style="font-family:Times New Roman; font-size:12pt;">
  <h1 style="text-align:center; font-size:18pt;">${escapeXml(title)}</h1>
  <p style="text-align:center; font-style:italic; font-size:13pt; color:#555;">${escapeXml(author)}</p>
  <hr style="margin:20pt 0;">
  ${paragraphsHtml}
</body>
</html>`;
    const blob = new Blob([docContent], { type: 'application/msword;charset=utf-8' });
    triggerDownload(blob, `${title}.doc`);
  }
  else if (format === 'epub') {
    const paragraphsHtml = text.split(/\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${escapeXml(p)}</p>`)
      .join('\n');

    const epubContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
  <style type="text/css">
    body { font-family: sans-serif; padding: 5%; line-height: 1.5; }
    h1 { text-align: center; }
    .author { text-align: center; color: #555; margin-bottom: 2em; }
    p { text-indent: 1em; margin: 0.5em 0; }
  </style>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
  <div class="author">${escapeXml(author)}</div>
  ${paragraphsHtml}
</body>
</html>`;
    const blob = new Blob([epubContent], { type: 'application/epub+zip;charset=utf-8' });
    triggerDownload(blob, `${title}.epub`);
  }
};

// ЧИТАТЬ В 3D
document.getElementById('btn-read-3d').addEventListener('click', async () => {
  if (!currentSelectedBook) return;
  const text = await fetchCleanBookText(currentSelectedBook.rawTitle, currentSelectedBook.cleanTitle);
  if (!text) return;

  const pages = autoSplitTextToPages(text);
  openBookReader(currentSelectedBook.cleanTitle, currentSelectedBook.author, pages);
});

// РЕЗЧИК СТРАНИЦ
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

    if (pages.length >= 350) break;
  }

  if (currentPageChunks.length > 0 && pages.length < 350) {
    pages.push(currentPageChunks.join('\n\n'));
  }

  if (pages.length % 2 !== 0) {
    pages.push(' ');
  }

  return pages;
}

// 3D-ЧИТАЛКА
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
          <div>
            <p>${text.replace(/\n\n/g, '</p><p>')}</p>
          </div>
          <div class="page-number">Страница ${pageNum++} из ${totalPages}</div>
        </div>
      </div>
    `;
  });

  pagesHtml += `
    <div class="my-page" data-density="hard">
      <div class="page-content" style="justify-content: center; text-align: center;">
        <h2 style="color: #f1dfc5;">Конец книги</h2>
      </div>
    </div>
  `;

  bookWrapper.innerHTML = `<div id="book">${pagesHtml}</div>`;

  setTimeout(() => {
    currentFlipBook = new St.PageFlip(document.getElementById('book'), {
      width: pageWidth,
      height: pageHeight,
      showCover: true,
      flippingTime: isMobile ? 600 : 850,
      maxShadowOpacity: 0.3,
      usePortrait: true 
    });
    currentFlipBook.loadFromHTML(document.querySelectorAll('.my-page'));
  }, 50);
}

backToDetailsBtn.addEventListener('click', () => {
  if (currentFlipBook) {
    currentFlipBook.destroy();
    currentFlipBook = null;
  }
  bookWrapper.innerHTML = '';
  readerView.style.display = 'none';
  if (currentSelectedBook) {
    detailsView.style.display = 'flex';
  } else {
    catalogView.style.display = 'flex';
  }
});

// КЛИКИ ПО КАТЕГОРИЯМ
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    searchInput.value = '';
    const category = btn.getAttribute('data-category');
    if (category) {
      loadCategory(category);
    }
  });
});

// ПОИСК ПО КНОПКЕ И ENTER
btnSearch.addEventListener('click', () => searchViaWikipedia(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchViaWikipedia(searchInput.value);
});

window.addEventListener('keydown', (e) => {
  if (!currentFlipBook) return;
  if (e.key === 'ArrowRight') currentFlipBook.flipNext();
  if (e.key === 'ArrowLeft') currentFlipBook.flipPrev();
});

// СТАРТ С ФАНТАСТИКИ
loadCategory('Категория:Фантастика');