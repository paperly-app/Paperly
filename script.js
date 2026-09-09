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
   2. ДИНАМИЧЕСКИЙ КАТАЛОГ: АВТОРЫ И КАТЕГОРИИ
   ========================================================== */
let currentFlipBook = null;

const booksGrid = document.getElementById('books-grid');
const searchInput = document.getElementById('search-input');
const btnSearch = document.getElementById('btn-search');
const catalogView = document.getElementById('catalog-view');
const readerView = document.getElementById('reader-view');
const bookWrapper = document.getElementById('book-wrapper');
const backBtn = document.getElementById('back-to-catalog-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingStatus = document.getElementById('loading-status');
const filterButtons = document.querySelectorAll('.filter-btn');

const BAN_WORDS = [
  'устав', 'район', 'область', 'кислота', 'пациент', 'рмг', 'гост', 'закон',
  'положение', 'федеральн', 'кодекс', 'рецептор', 'ингибирует', 'эсбе', 'бсэ',
  'мэсбе', 'рrecord', 'категория', 'викитека', 'указатель', 'шаблон:', 'документ', 'постановление'
];

// ЗАГРУЗКА ОФИЦИАЛЬНЫХ КАТЕГОРИЙ ВИКИТЕКИ
async function loadCategory(categoryTitle) {
  booksGrid.innerHTML = `<div style="color:#8f7e70; margin-top:40px;">Загружаем книги из «${categoryTitle.replace('Категория:', '')}»...</div>`;

  try {
    const url = `https://ru.wikisource.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(categoryTitle)}&cmlimit=60&cmnamespace=0&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const members = data.query?.categorymembers || [];

    const finalCards = [];
    const catName = categoryTitle.replace('Категория:', '');

    members.forEach(item => {
      const t = item.title;
      const lower = t.toLowerCase();

      const cleanSlash = t.replace('/ДО', '');
      if (cleanSlash.includes('/')) return;
      if (BAN_WORDS.some(w => lower.includes(w))) return;
      if (t.startsWith('О ') || t.startsWith('Об ') || t.includes('рецензия')) return;

      let cleanTitle = cleanSlash.replace(/\s*\(.*?\)/g, '').trim();
      let authorMatch = t.match(/\((.*?)\)/);
      let authorHint = authorMatch ? authorMatch[1].split(';')[0].replace('/ДО', '').trim() : catName;

      if (!finalCards.some(c => c.cleanTitle.toLowerCase() === cleanTitle.toLowerCase())) {
        finalCards.push({
          rawTitle: t,
          cleanTitle: cleanTitle,
          author: authorHint,
          snippet: `Произведение из официального фонда «${catName}» библиотеки Викитека.`
        });
      }
    });

    renderBookCards(finalCards);
  } catch (err) {
    booksGrid.innerHTML = '<div style="color:#c97a7a; margin-top:40px;">Ошибка подключения к архивам. Проверьте интернет!</div>';
  }
}

// УМНЫЙ ПОИСК АВТОРА
async function searchBooks(query) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return;

  filterButtons.forEach(b => b.classList.remove('active'));
  booksGrid.innerHTML = '<div style="color:#8f7e70; margin-top:40px;">Ищем произведения автора в архивах...</div>';

  try {
    let finalCards = [];

    // 1. Проверяем страницу "Автор:Имя Фамилия"
    const authorSearchUrl = `https://ru.wikisource.org/w/api.php?action=opensearch&search=${encodeURIComponent('Автор:' + cleanQuery)}&limit=5&format=json&origin=*`;
    const authorRes = await fetch(authorSearchUrl);
    const authorData = await authorRes.json();
    const authorPages = (authorData[1] || []).filter(t => t.startsWith('Автор:'));

    if (authorPages.length > 0) {
      const authorPage = authorPages[0];
      const authorCleanName = authorPage.replace('Автор:', '');

      const linksUrl = `https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(authorPage)}&prop=links&format=json&origin=*`;
      const linksRes = await fetch(linksUrl);
      const linksData = await linksRes.json();
      const allLinks = (linksData.parse?.links || [])
        .filter(l => l.ns === 0)
        .map(l => l['*']);

      allLinks.forEach(t => {
        const cleanSlash = t.replace('/ДО', '');
        if (cleanSlash.includes('/')) return;
        if (BAN_WORDS.some(w => t.toLowerCase().includes(w))) return;

        let cleanTitle = cleanSlash.replace(/\s*\(.*?\)/g, '').trim();
        if (cleanTitle.length < 2) return;

        if (!finalCards.some(c => c.cleanTitle.toLowerCase() === cleanTitle.toLowerCase())) {
          finalCards.push({
            rawTitle: t,
            cleanTitle: cleanTitle,
            author: authorCleanName,
            snippet: `Официальное сочинение автора ${authorCleanName}.`
          });
        }
      });
    }

    // 2. Если искали название книги
    if (finalCards.length === 0) {
      const searchUrl = `https://ru.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query.trim())}&srlimit=45&srnamespace=0&format=json&origin=*`;
      const sRes = await fetch(searchUrl);
      const sData = await sRes.json();
      const results = sData.query?.search || [];

      results.forEach(item => {
        const t = item.title;
        const lower = t.toLowerCase();

        if (BAN_WORDS.some(w => lower.includes(w))) return;
        const cleanSlash = t.replace('/ДО', '');
        if (cleanSlash.includes('/')) return;

        let cleanTitle = cleanSlash.replace(/\s*\(.*?\)/g, '').trim();
        let authorMatch = t.match(/\((.*?)\)/);
        let authorHint = authorMatch ? authorMatch[1].split(';')[0].replace('/ДО', '').trim() : 'Классика';

        if (authorHint && !authorHint.toLowerCase().includes(cleanQuery) && cleanTitle.toLowerCase().includes(cleanQuery)) {
          return;
        }
        if (lower.startsWith('о ') || lower.startsWith('об ') || lower.includes('рецензия')) return;

        if (!finalCards.some(c => c.cleanTitle.toLowerCase() === cleanTitle.toLowerCase())) {
          finalCards.push({
            rawTitle: t,
            cleanTitle: cleanTitle,
            author: authorHint,
            snippet: item.snippet.replace(/<[^>]*>?/gm, '')
          });
        }
      });
    }

    renderBookCards(finalCards);
  } catch (err) {
    booksGrid.innerHTML = '<div style="color:#c97a7a; margin-top:40px;">Ошибка поиска. Проверьте интернет!</div>';
  }
}

function renderBookCards(cards) {
  booksGrid.innerHTML = '';
  if (cards.length === 0) {
    booksGrid.innerHTML = '<div style="color:#8f7e70; margin-top:40px;">Книг не найдено. Попробуйте другой запрос!</div>';
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
      <div class="card-footer">Читать онлайн →</div>
    `;

    card.addEventListener('click', () => loadAndOpenOnlineBook(book.rawTitle, book.cleanTitle, book.author));
    booksGrid.appendChild(card);
  });
}

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

btnSearch.addEventListener('click', () => searchBooks(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchBooks(searchInput.value);
});

// УМНОЕ СКАЧИВАНИЕ: САМО ПЕРЕХОДИТ СО СПИСКА ПЕРЕВОДОВ НА ПОЛНУЮ КНИГУ
async function loadAndOpenOnlineBook(rawTitle, displayTitle, authorHint) {
  loadingOverlay.style.display = 'flex';
  loadingStatus.textContent = `Скачиваем «${displayTitle}»...`;

  try {
    let targetPage = rawTitle;

    // ШАГ 1: Скачиваем начальную страницу
    let url = `https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(targetPage)}&prop=text|links&format=json&origin=*`;
    let res = await fetch(url);
    let data = await res.json();

    if (!data.parse || !data.parse.text) throw new Error();

    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.parse.text['*'];

    // ВЫЧИСЛЯЕМ: ЭТО СПИСОК ПЕРЕВОДОВ ИЛИ УЖЕ САМА КНИГА?
    // Если страница содержит слова «Русские издания» или ссылки на конкретные издания (Ницше; Антоновский и др.):
    if (tempDiv.innerText.includes('Русские издания') || tempDiv.innerText.length < 1200) {
      const editionLink = (data.parse.links || []).find(l => 
        l.ns === 0 && 
        l['*'].startsWith(displayTitle) && 
        l['*'].includes('(') && 
        !l['*'].endsWith('/ДО')
      );

      // Если нашли ссылку на конкретный перевод — переключаемся на него!
      if (editionLink) {
        targetPage = editionLink['*'];
        url = `https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(targetPage)}&prop=text|links&format=json&origin=*`;
        res = await fetch(url);
        data = await res.json();
        tempDiv.innerHTML = data.parse.text['*'];
      }
    }

    // Чистим от служебных элементов
    tempDiv.querySelectorAll(`
      .mw-editsection, .navigation, .infobox, style, script, .reference, .noprint,
      .licenseContainer, .boilerplate, .headerContainer, .headertemplate, .ws-noexport,
      .textinfo, .ws-summary, table, .toc, .pagelist, [id*="license"], [class*="license"], [id*="header"]
    `).forEach(el => el.remove());

    let text = tempDiv.innerText.trim();

    const ignoredSubpages = [
      'содержание', 'оглавление', 'таблица соответствия', 'соответствие страниц',
      'указатель', 'примечания', 'варианты', 'иллюстрации', 'список опечаток',
      'до', 'источники', 'библиография'
    ];

    // ШАГ 2: Если книга разбита на подглавы (как у Заратустры) — качаем их все!
    if (text.length < 4000 && data.parse.links) {
      const subchapters = data.parse.links
        .filter(l => {
          const title = l['*'];
          if (!title.startsWith(targetPage + '/')) return false;
          const lower = title.toLowerCase();
          return !ignoredSubpages.some(sub => lower.includes('/' + sub) || lower.endsWith(sub));
        })
        .map(l => l['*']);

      if (subchapters.length > 0) {
        loadingStatus.textContent = `Качаем все части и главы...`;
        const chaptersToDownload = subchapters.slice(0, 30);

        const chapterPromises = chaptersToDownload.map(chTitle => 
          fetch(`https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(chTitle)}&prop=text&format=json&origin=*`)
            .then(r => r.json())
            .then(subData => {
              if (subData.parse && subData.parse.text) {
                const subDiv = document.createElement('div');
                subDiv.innerHTML = subData.parse.text['*'];
                subDiv.querySelectorAll(`
                  .mw-editsection, .navigation, .infobox, style, script, .reference, .noprint,
                  .licenseContainer, .boilerplate, .headerContainer, .headertemplate, .ws-noexport,
                  .textinfo, .ws-summary, table, .toc, .pagelist, [id*="license"], [class*="license"], [id*="header"]
                `).forEach(el => el.remove());
                return subDiv.innerText.trim();
              }
              return '';
            })
            .catch(() => '')
        );

        const loadedChapters = await Promise.all(chapterPromises);
        const fullCombined = loadedChapters.filter(t => t.length > 50).join('\n\n');

        if (fullCombined.length > 500) text = fullCombined;
      }
    }

    // Чистка от пар цифр сканов
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
             !l.includes('таблица соответствия') &&
             !l.includes('русские издания') &&
             !l.includes('az.lib.ru') &&
             !l.includes('источник:') &&
             !l.includes('опубл.:') &&
             !l.includes('перевод опубл') &&
             !l.includes('исключительного права') &&
             !l.includes('согласно ст.');
    });

    text = cleanLines.join('\n').trim();

    if (text.length < 100) {
      alert('Не удалось извлечь текст книги. Попробуйте другую!');
      loadingOverlay.style.display = 'none';
      return;
    }

    const pages = autoSplitTextToPages(text);
    loadingOverlay.style.display = 'none';
    openBookReader(displayTitle, authorHint, pages);
  } catch (e) {
    loadingOverlay.style.display = 'none';
    alert('Ошибка при загрузке. Попробуйте соседнее издание!');
  }
}

// ПЛОТНЫЙ НЕПРЕРЫВНЫЙ РЕЗЧИК
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
        if (cut === -1 || cut < maxChars * 0.65) {
          cut = maxChars;
        }
        
        let chunk = p.slice(0, cut).trim();
        if (chunk.length > 0) {
          currentPageChunks.push(chunk);
        }

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

// ОТКРЫТИЕ 3D-КНИГИ
function openBookReader(title, author, pages) {
  catalogView.style.display = 'none';
  readerView.style.display = 'flex';

  const isMobile = window.innerWidth <= 768;

  const pageWidth = isMobile 
    ? Math.min(window.innerWidth - 20, 380) 
    : 480;
  const pageHeight = isMobile 
    ? Math.min(window.innerHeight - 80, 580) 
    : 680;

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

backBtn.addEventListener('click', () => {
  if (currentFlipBook) {
    currentFlipBook.destroy();
    currentFlipBook = null;
  }
  bookWrapper.innerHTML = '';
  readerView.style.display = 'none';
  catalogView.style.display = 'flex';
});

window.addEventListener('keydown', (e) => {
  if (!currentFlipBook) return;
  if (e.key === 'ArrowRight') currentFlipBook.flipNext();
  if (e.key === 'ArrowLeft') currentFlipBook.flipPrev();
});

loadCategory('Категория:Фантастика');