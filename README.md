# 📖 Paperly — 3D Web Book Reader & Digital Library

[![Live Demo](https://img.shields.io/badge/Live_Demo-paperly--app.github.io-success?style=for-the-badge&logo=github)](https://paperly-app.github.io/Paperly/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Tech](https://img.shields.io/badge/Tech-Vanilla_JS_•_HTML5_Canvas_•_Python_3.11-orange?style=for-the-badge)]()

**Paperly** — это современная веб-читалка с реалистичной физикой перелистывания 3D-страниц, динамическим стримингом мировой литературы, ночным светом и конвертером электронных книг.

---

## 🌟 Главные фичи (Features)

* 📖 **Реалистичная 3D-физика страниц:** перелистывание с матовыми тенями, изгибом бумаги и адаптацией под экраны (1 страница на смартфонах, 2 страницы на ПК).
* 🕯️ **Режим защиты глаз (Night Light):** мягкий янтарный светофильтр (свет свечи) для комфортного ночного чтения без синего спектра.
* ⚡ **Гибридная архитектура (Hybrid Engine):** мгновенный доступ к локальной коллекции + потоковый он-деманд поиск по мировым архивам (Викитека, Open Library).
* 📥 **Универсальный конвертер форматов:** скачивание любого произведения в `.FB2` (для ридеров), `.EPUB` (Apple Books), `.TXT`, `.DOC` и `.HTML`.
* 📁 **Drag & Drop читалка:** возможность перетащить любой файл `.txt` или `.fb2` с компьютера прямо в окно браузера для мгновенного чтения в 3D.
* 📏 **Непрерывная строчная верстка:** плотное заполнение страниц без пустых полей и обрубков текста.

---

## 🛠️ Архитектура и стек (Tech Stack)

* **Frontend:** Чистый JavaScript (ES6+), HTML5 Canvas, StPageFlip Engine, CSS3 Grid/Flexbox.
* **Backend / ETL:** Python 3.11, `requests` (Session connection pooling), `beautifulsoup4`, `concurrent.futures` (многопоточный парсер).
* **Стриминг данных:** MediaWiki API, Open Library API, CORS-safe proxy gateways.
* **Деплой:** GitHub Pages (Zero-config production CDN).

---

## 📂 Структура проекта (Repository Structure)

```text
paperly/
├── index.html         # Разметка UI, модальные окна и экраны
├── style.css          # Темная типографическая тема и адаптивная верстка
├── script.js          # Ядро читалки, гибридный диспетчер и конвертеры
├── database.json      # Локальная база верифицированных произведений
├── parser.py          # Многопоточный Python-парсер с литературной редактурой
├── requirements.txt   # Зависимости для Python-робота
└── README.md          # Документация проекта