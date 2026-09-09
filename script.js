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

// ЗОЛОТОЙ ФОНД ОРИГИНАЛОВ
const VERIFIED_AUTHORS = {
  'ницше': [
    { title: 'Так говорил Заратустра', wiki: 'Так говорил Заратустра (Ницше; Антоновский)', author: 'Фридрих Ницше', snippet: 'Главная книга Ницше. Философская поэма о Сверхчеловеке, воле к власти и вечном возвращении.' },
    { title: 'По ту сторону добра и зла', wiki: 'По ту сторону добра и зла (Ницше)', author: 'Фридрих Ницше', snippet: 'Прелюдия к философии будущего. Беспощадная критика европейской морали и догм.' },
    { title: 'Рождение трагедии из духа музыки', wiki: 'Рождение трагедии, или Эллинство и пессимизм (Ницше/Рачинский)', author: 'Фридрих Ницше', snippet: 'Культовый труд об аполлоническом и дионисийском началах в искусстве и жизни.' },
    { title: 'Сумерки идолов (Падение кумиров)', wiki: 'Падение кумиров (Ницше)', author: 'Фридрих Ницше', snippet: 'Как философствуют молотом. Яркая и острая переоценка всех ценностей.' },
    { title: 'Человеческое, слишком человеческое', wiki: 'Человеческое, слишком человеческое (Ницше)', author: 'Фридрих Ницше', snippet: 'Книга для свободных умов. Сборник глубоких афоризмов о человеческой природе.' },
    { title: 'Антихрист', wiki: 'Антихрист (Ницше)', author: 'Фридрих Ницше', snippet: 'Знаменитый философский манифест с критикой религии и упадка культуры.' }
  ],
  'пушкин': [
    { title: 'Пиковая дама', wiki: 'Пиковая дама (Пушкин)', author: 'А. С. Пушкин', snippet: 'Мистическая повесть о тайне трех карт, графине и безумии Германна.' },
    { title: 'Метель', wiki: 'Метель (повесть)', author: 'А. С. Пушкин', snippet: 'Знаменитая повесть из цикла «Повести Белкина» о судьбоносной игре случая.' },
    { title: 'Капитанская дочка', wiki: 'Капитанская дочка (Пушкин)', author: 'А. С. Пушкин', snippet: 'Исторический роман о пугачевском бунте, чести и верной любви.' }
  ],
  'достоевский': [
    { title: 'Преступление и наказание', wiki: 'Преступление и наказание (Достоевский)', author: 'Фёдор Достоевский', snippet: 'Петербург, Раскольников и теория о «тварях дрожащих» и «право имеющих».' },
    { title: 'Белые ночи', wiki: 'Белые ночи (Достоевский)', author: 'Фёдор Достоевский', snippet: 'Сентиментальный роман из воспоминаний мечтателя под петербургским небом.' },
    { title: 'Идиот', wiki: 'Идиот (роман)', author: 'Фёдор Достоевский', snippet: 'Трагическая судьба чистого душой князя Мышкина в порочном обществе.' }
  ],
  'толстой': [
    { title: 'Смерть Ивана Ильича', wiki: 'Смерть Ивана Ильича (Толстой)', author: 'Лев Толстой', snippet: 'Одна из вершин мировой литературы: глубочайшее исследование смысла жизни.' },
    { title: 'Кавказский пленник', wiki: 'Кавказский пленник (Толстой)', author: 'Лев Толстой', snippet: 'Классическая повесть о дружбе, храбрости и силе человеческого духа.' },
    { title: 'После бала', wiki: 'После бала (Толстой)', author: 'Лев Толстой', snippet: 'Знаменитый рассказ о любви, чести и жестокой изнанке эпохи.' }
  ],
  'чехов': [
    { title: 'Палата № 6', wiki: 'Палата № 6 (Чехов)', author: 'Антон Чехов', snippet: 'Глубокая психологическая повесть о границе между безумием и разумом.' },
    { title: 'Человек в футляре', wiki: 'Человек в футляре (Чехов)', author: 'Антон Чехов', snippet: 'Бессмертный рассказ об учителе Беликове, панически боявшемся реальной жизни.' }
  ]
};

// ПОИСК
async function searchBooks(query = 'Ницше') {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return;

  booksGrid.innerHTML = '<div style="color:#8f7e70; margin-top:40px;">Отбираем оригинальные произведения...</div>';
  let finalCards = [];

  for (const authorKey in VERIFIED_AUTHORS) {
    if (cleanQuery.includes(authorKey) || authorKey.includes(cleanQuery)) {
      finalCards = VERIFIED_AUTHORS[authorKey].map(b => ({
        rawTitle: b.wiki,
        cleanTitle: b.title,
        author: b.author,
        snippet: b.snippet,
        isVerified: true
      }));
      break;
    }
  }

  try {
    const url = `https://ru.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query.trim())}&srlimit=35&srnamespace=0&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const results = data.query?.search || [];

    const banList = ['ЭСБЕ', 'БСЭ', 'МЭСБЕ', 'РБС', 'ВЭ', 'ЕЭБЕ', 'НЭС', 'ПБЭ', 'БЭЮ', 'Категория', 'Викитека', 'Указатель'];

    results.forEach(item => {
      const t = item.title;
      if (banList.some(ban => t.startsWith(ban + '/') || t.includes(ban))) return;
      if (t.includes('/От переводчика') || t.includes('/Предисловие') || t.includes('/Примечания') || t.endsWith('/ДО')) return;
      if (t.includes('/Фридрих Ницше') || t.startsWith('Вырождение/')) return;
      if (finalCards.some(c => c.cleanTitle.toLowerCase() === t.toLowerCase())) return;

      let cleanTitle = t.replace(/\s*\(.*?\)/g, '');
      let authorMatch = t.match(/\((.*?)\)/);
      let authorHint = authorMatch ? authorMatch[1].split(';')[0].replace('/ДО', '') : 'Классика';

      finalCards.push({
        rawTitle: t,
        cleanTitle: cleanTitle,
        author: authorHint,
        snippet: item.snippet.replace(/<[^>]*>?/gm, ''),
        isVerified: false
      });
    });

    renderBookCards(finalCards);
  } catch (err) {
    if (finalCards.length > 0) renderBookCards(finalCards);
    else booksGrid.innerHTML = '<div style="color:#c97a7a; margin-top:40px;">Ошибка подключения. Проверьте интернет!</div>';
  }
}

function renderBookCards(cards) {
  booksGrid.innerHTML = '';
  if (cards.length === 0) {
    booksGrid.innerHTML = '<div style="color:#8f7e70; margin-top:40px;">Ничего не найдено. Попробуйте другой запрос!</div>';
    return;
  }

  cards.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    if (book.isVerified) {
      card.style.borderColor = '#c98a4b';
      card.style.boxShadow = '0 15px 35px rgba(201, 138, 75, 0.15)';
    }

    card.innerHTML = `
      <div>
        <div class="card-author">${book.isVerified ? '★ ОРИГИНАЛ: ' + book.author : book.author}</div>
        <div class="card-title">${book.cleanTitle}</div>
        <div class="card-snippet">${book.snippet}</div>
      </div>
      <div class="card-footer">${book.isVerified ? 'Читать шедевр →' : 'Читать онлайн →'}</div>
    `;

    card.addEventListener('click', () => loadAndOpenOnlineBook(book.rawTitle, book.cleanTitle, book.author));
    booksGrid.appendChild(card);
  });
}

// СКАЧИВАНИЕ И СКЛЕЙКА
async function loadAndOpenOnlineBook(rawTitle, displayTitle, authorHint) {
  loadingOverlay.style.display = 'flex';
  loadingStatus.textContent = `Скачиваем «${displayTitle}»...`;

  try {
    const url = `https://ru.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(rawTitle)}&prop=text|links&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.parse || !data.parse.text) throw new Error();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.parse.text['*'];

    tempDiv.querySelectorAll(`
      .mw-editsection, .navigation, .infobox, style, script, .reference, .noprint,
      .licenseContainer, .boilerplate, .headerContainer, .headertemplate, .ws-noexport,
      .textinfo, .ws-summary, table, [id*="license"], [class*="license"], [id*="header"]
    `).forEach(el => el.remove());

    let text = tempDiv.innerText.trim();

    if (text.length < 2500 && data.parse.links) {
      const subchapters = data.parse.links
        .filter(l => l['*'].startsWith(rawTitle + '/') && !l['*'].endsWith('/ДО'))
        .map(l => l['*']);

      if (subchapters.length > 0) {
        loadingStatus.textContent = `Качаем все главы книги...`;
        const chaptersToDownload = subchapters.slice(0, 25);

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
                  .textinfo, .ws-summary, table, [id*="license"], [class*="license"], [id*="header"]
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

    const lines = text.split(/\r?\n/);
    const cleanLines = lines.filter(line => {
      const l = line.toLowerCase();
      return !l.includes('общественное достояние') &&
             !l.includes('ст. 1281') &&
             !l.includes('авторского права') &&
             !l.includes('az.lib.ru') &&
             !l.includes('источник:') &&
             !l.includes('опубл.:') &&
             !l.includes('перевод опубл') &&
             !l.includes('исключительного права') &&
             !l.includes('срок охраны') &&
             !l.includes('согласно ст.') &&
             !l.includes('производным произведением');
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

// 1. ИСПРАВЛЕНИЕ: СНИЖАЕМ ПОРОГ СИМВОЛОВ (480 вместо 750), ЧТОБЫ ПУШКИН НЕ ВЫВАЛИВАЛСЯ
function autoSplitTextToPages(rawText) {
  const isMobile = window.innerWidth <= 768;
  // На телефоне экран меньше, берем 400 символов, на ПК — 500 символов
  const charsPerPage = isMobile ? 400 : 480; 
  
  const paragraphs = rawText.split(/\r?\n/);
  const pages = [];
  let currentPage = '';

  for (let p of paragraphs) {
    p = p.trim();
    if (!p) continue;

    if ((currentPage + '\n\n' + p).length > charsPerPage) {
      if (currentPage) {
        pages.push(currentPage);
        currentPage = '';
      }
      while (p.length > charsPerPage) {
        let cut = p.lastIndexOf(' ', charsPerPage);
        if (cut === -1) cut = charsPerPage;
        pages.push(p.slice(0, cut));
        p = p.slice(cut).trim();
      }
    }
    currentPage += (currentPage ? '\n\n' : '') + p;

    if (pages.length >= 350) break;
  }
  if (currentPage && pages.length < 350) pages.push(currentPage);

  if (pages.length % 2 !== 0) {
    pages.push(' ');
  }

  return pages;
}

// 2. ИСПРАВЛЕНИЕ: УМНЫЙ АДАПТИВНЫЙ РАЗМЕР КНИГИ ДЛЯ ТЕЛЕФОНА И ПК
function openBookReader(title, author, pages) {
  catalogView.style.display = 'none';
  readerView.style.display = 'flex';

  const isMobile = window.innerWidth <= 768;

  // Динамические размеры под телефон или ПК
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
      
      // НА ТЕЛЕФОНЕ ВКЛЮЧАЕТ 1 СТРАНИЦУ, НА ПК — 2 СТРАНИЦЫ:
      usePortrait: isMobile 
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

btnSearch.addEventListener('click', () => searchBooks(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchBooks(searchInput.value);
});

window.triggerSearch = function(name) {
  searchInput.value = name;
  searchBooks(name);
};

window.addEventListener('keydown', (e) => {
  if (!currentFlipBook) return;
  if (e.key === 'ArrowRight') currentFlipBook.flipNext();
  if (e.key === 'ArrowLeft') currentFlipBook.flipPrev();
});

// ТАБЛИЧКА И СВЕТ
const overlay = document.getElementById('warm-overlay');
const toggleBtn = document.getElementById('warm-toggle-btn');
const modal = document.getElementById('modal-backdrop');
const btnTurnOn = document.getElementById('btn-turn-on');
const btnTurnOff = document.getElementById('btn-turn-off');

function activateWarmMode() {
  overlay.classList.add('active');
  toggleBtn.textContent = '☀️ Обычный';
}

function deactivateWarmMode() {
  overlay.classList.remove('active');
  toggleBtn.textContent = '🕯️ Защита глаз';
}

function closeModal() {
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 500);
  }
}

if (btnTurnOn) {
  btnTurnOn.addEventListener('click', () => {
    activateWarmMode();
    closeModal();
  });
}

if (btnTurnOff) {
  btnTurnOff.addEventListener('click', () => {
    closeModal();
  });
}

toggleBtn.addEventListener('click', () => {
  if (overlay.classList.contains('active')) deactivateWarmMode();
  else activateWarmMode();
});

searchBooks('Ницше');