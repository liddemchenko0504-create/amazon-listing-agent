# amazon-listing-agent

MVP экстрактор Amazon-листинга по ASIN, без AI. Основа для будущего
Beauty-аудита (completeness, claims, OCR по A+ картинкам, VOC по отзывам).

## Статус: Stage 1 — Extractor

Извлекает: title, bullets, description, brand, rating, reviewCount,
gallery images, наличие видео, A+ (кол-во модулей + image URLs),
variations. Помечает каждый блок статусом `PRESENT / WEAK / MISSING /
NOT_ACCESSIBLE`.

**Не входит в Stage 1** (сознательно отложено): ingredients/directions/
warnings из Product Details (нужен отдельный парсер таблицы, разный
формат по категориям), Brand Story, Comparison Chart, Premium A+
carousels, backend keywords (недоступны без Seller Central доступа
к своему листингу).

## Установка

```bash
npm install
npm install -D typescript tsx @types/node
npm install cheerio
```

## Запуск

Против сохранённой fixture (рекомендуется для разработки/тестов,
не долбит Amazon лишними запросами):

```bash
npx tsx extractor/run.ts B0B2RM68G2 --fixture fixtures/B0B2RM68G2/page.html
```

Живой запрос (используйте умеренно, с учётом ToS Amazon и
robots.txt; для продакшена рассмотрите официальные data-provider'ы —
Rainforest API, Oxylabs, Keepa — вместо прямого скрапинга):

```bash
npx tsx extractor/run.ts B0B2RM68G2
```

Результат пишется в `output/<ASIN>.json` по схеме
`schemas/listing.schema.json`.

## Как получить fixture для теста

1. Открыть `https://www.amazon.com/dp/B0B2RM68G2` в браузере.
2. View Source → сохранить как `fixtures/B0B2RM68G2/page.html`.
3. Запустить команду выше с `--fixture`.

Это нужно, потому что живой fetch с датацентрового IP почти всегда
ловит capcha/бан — для стабильной работы либо residential proxy,
либо headless browser (Playwright) с человекоподобным поведением,
либо платный provider.

## Roadmap

1. ✅ Extractor — базовые публичные поля (этот репозиторий)
2. Image Downloader — сохранить gallery + A+ картинки локально
3. OCR — вытащить текст с A+ картинок (например Tesseract или Claude vision)
4. Content Inventory — свести всё в единый статус-отчёт
5. Beauty Audit — completeness score, claims-проверка, gap detection
6. AI Optimization — сгенерировать улучшенные title/bullets/недостающие блоки
7. Review Analysis (VOC) — отдельный модуль по отзывам
8. UI — поле ввода ASIN + dashboard (Extracted Content / Audit & Recommendations)

## Важно про комплаенс

- Уважайте `robots.txt` и Terms of Service Amazon.
- Не увеличивайте частоту запросов до уровня, который можно
  расценить как злоупотребление / DDoS.
- Для реального claims-аудита (например "clinically proven",
  "dermatologist tested") храните источник/пруф отдельно — это не
  технический, а юридический вопрос, и его должен смотреть юрист
  перед использованием в маркетинге.
