# TrueScale App Audit And Roadmap

Рабочий фокус: программная часть приложения в `planscale-seo/app`, без лендингов и SEO-страниц.

## Текущее Состояние

TrueScale сейчас является статическим браузерным приложением без backend. Пользователь загружает изображение, задает одну известную длину, а приложение пересчитывает остальные отрезки и площади по пропорции.

Основная логика находится в:

- `planscale-seo/app/app.js` - состояние, Canvas, события, жесты, история, измерения.
- `planscale-seo/app/app-export.js` - экспорт PNG, PDF, SVG, CSV, JSON и share-link.
- `planscale-seo/app/detection-core.js` - поиск горизонтальных и вертикальных линий на изображении.
- `planscale-seo/app/detection-worker.js` - Web Worker для распознавания.
- `planscale-seo/app/snap.js` и `geometry.js` - привязки, расстояния, геометрия.
- `planscale-seo/app/styles.css` - весь UI приложения.

Сильная сторона: приложение уже функциональное, приватное, без серверной зависимости, с рабочими desktop/mobile сценариями.

Главная слабость: код приложения вырос органически. `app.js` и `styles.css` стали монолитами, где поддерживать новые фичи будет все дороже.

## Критичные Улучшения

### 1. Единицы Измерения

Сейчас единицы работают в основном как подпись. Если пользователь откалибровал 5 м, а потом переключил единицу на см, значение не конвертируется, меняется только label. Это может давать неверный результат и подрывает доверие.

Нужно:

- Ввести внутреннюю базовую единицу, например meter.
- Хранить `referenceValueBase`.
- Конвертировать UI input между `m`, `cm`, `mm`, `km`, `ft`, `in`.
- В экспорте явно отдавать и display-value, и normalized-value.
- Добавить тесты на конвертацию.

### 2. Декомпозиция `app.js`

`app.js` стоит разрезать постепенно, без большого переписывания за один раз.

Предлагаемый порядок:

- `state.js` - shape состояния, snapshot, restore.
- `history.js` - undo/redo, localStorage persistence.
- `measurement.js` - reference length, calculated length, area, formatting.
- `canvas-view.js` - scale, offset, image/screen conversions, fit/zoom.
- `canvas-renderer.js` - все `draw*`.
- `interactions.js` - pointer/wheel/keyboard/gesture events.
- `ui-controller.js` - синхронизация DOM-контролов.

Правило: каждый шаг должен проходить текущий smoke-test.

### 3. CSS Cleanup

`styles.css` содержит много поздних override-блоков и `!important`. Это выглядит как накопленные правки поверх старой структуры.

Нужно разделить:

- `base.css` - variables, reset, typography.
- `layout.css` - app shell, panel, topbar, canvas area.
- `controls.css` - buttons, menus, forms.
- `canvas-overlays.css` - ruler, inline calibration, hints.
- `mobile.css` - mobile-only layout.

После этого удалить дубли и поздние override-слои.

### 4. Стабильные Зависимости

Сейчас нет lockfile. Нужно добавить `package-lock.json` или перейти на pnpm с `pnpm-lock.yaml`.

Минимально:

- Выполнить `npm install` в нормальном Node окружении.
- Закоммитить lockfile.
- Убрать зависимость от плавающего `^` для Playwright или зафиксировать через lockfile.

### 5. Тестовое Покрытие

Сейчас есть хороший smoke-test, но нет маленьких unit-тестов на математику и состояние.

Добавить тесты на:

- `parseDecimal`, formatting, unit conversion.
- `segmentLength`, polygon area, centroid.
- restore из hash share-link.
- JSON/CSV export payload.
- удаление базового отрезка и сохранение масштаба.
- detection-core на синтетических картинках.

## Продуктовые Улучшения Приложения

### Измерения

- Настоящая конвертация единиц.
- Отдельный режим "масштаб заблокирован", чтобы случайно не испортить базу.
- Явный индикатор точности: "расчет по пропорции, не учитывает перспективу".
- Поддержка нескольких scale-зон позже, если изображение неравномерное или перспективное.

### Редактирование

- Rename без `prompt()`, через inline input/popover.
- Confirm/reset без `confirm()`, через нормальный modal.
- История действий с понятными именами: "добавлен отрезок", "изменена база".
- Выделение и удаление полигонов в панели, не только на Canvas.

### Экспорт

- Экспорт проекта в `.truescale.json`, который можно импортировать обратно.
- Импорт JSON проекта.
- CSV с защитой от spreadsheet formula injection.
- PDF с метаданными: дата, imageName, scale, unit.

### Автораспознавание

- Сейчас алгоритм хорошо подходит для простых чертежей с горизонталями/вертикалями.
- Нужно явно назвать это "поиск линий плана", а не универсальный AI.
- Добавить тестовые fixtures для разных планов.
- Позже: режимы "floor plan", "map", "object photo".

### Монетизация

Для баннерной рекламы важно не ломать рабочую область.

Лучшие места:

- Desktop: правый panel bottom или отдельная нижняя полоса под canvas.
- Mobile: реклама только после завершения действия или в панели измерений, не поверх Canvas.
- Не вставлять рекламу в topbar/canvas overlays.

## Cleanup Кандидаты

Проверить и удалить/почистить:

- `.DS_Store` в корне и внутри `planscale-seo`.
- `planscale-seo/.clineignore`, если он не нужен новому процессу.
- Мертвый код `drawRightAngleHints`, если подсказки углов пока отключены намеренно.
- Скрытый `.snap-toggle`, если smart-grid больше не должен быть пользовательской настройкой.
- Неиспользуемые DOM-ссылки вроде `fitButton`, если в HTML уже нет такого элемента.

## Предлагаемый План Работы

### Этап 1 - Зафиксировать Базу

- Перенести проект в нормальную рабочую папку.
- Добавить lockfile.
- Прогнать syntax + smoke.
- Удалить `.DS_Store`.
- Создать ветку `codex/app-hardening`.

### Этап 2 - Исправить Единицы

- Ввести conversion helper.
- Обновить UI, state, export.
- Добавить unit-тесты.
- Прогнать smoke.

### Этап 3 - Маленькая Декомпозиция

- Вынести measurement logic.
- Вынести history/persistence.
- Вынести renderer helpers.
- Не менять UX на этом этапе.

### Этап 4 - UI Cleanup

- Заменить prompt/confirm на собственные popover/modal.
- Причесать topbar и mobile layout.
- Разобрать CSS на файлы.

### Этап 5 - Проектный Формат

- Добавить save/load project JSON.
- Сделать share-link более устойчивым.
- Подготовить формат данных к будущему backend или рекламе.

## Definition Of Done На Ближайший Цикл

Считать приложение "допиленным до стабильной версии 1.0" можно, когда:

- Единицы измерения корректно конвертируются.
- Проект можно сохранить и загрузить обратно.
- Smoke-test проходит на desktop/mobile.
- Есть unit-тесты на измерения, экспорт и restore.
- `app.js` уменьшен хотя бы на 30-40%.
- CSS перестал зависеть от длинного хвоста override-правок.
- Нет `.DS_Store` и лишних локальных файлов в репозитории.
