# AGENTS.md — Alfanomy (mapp)

Правила и техническая память проекта. Читается каждой сессией. Карточка
в общей памяти — `memory/apps/alfanomy.md`; здесь всё подробно.

## 1. Что это

Мобильный клиент системы мониторинга транспорта ООО «Альфаномия»
(`alfanomy.ru`). Android и iPhone — обёртка WebView над веб-клиентом
`mapp-1.2` (движок AlfaSputnik, карты Leaflet 0.7.3). Пакет
`ru.alfanomy.mapp`. Публикация — RuStore и App Store.

## 2. Как ведётся работа

- Вся работа идёт через GitHub: правка → коммит и пуш → сборка в Actions.
  Локальные сборки не делаются, JDK/Gradle/Android SDK не нужны.
- Рабочая ветка — `release/2.0`. `main` отстаёт и не ведётся; `release/1.0`
  и `feature/*` — история.
- Веб-клиент, веб-версия и серверные скрипты — ветка `web-app` (`web/`).
- Коммит и пуш — по завершении законченной порции работы.
- Ключи, пароли и `keystore.properties` в репозиторий не коммитить.
  `keystore/debug.keystore` — стандартный debug-ключ, это не секрет.
- Замеченное по ходу, но не заказанное — в `BACKLOG.md`, а не в код.

## 3. Сборки и релизы

`.github/workflows/android.yml` — на пуш в `main`/`master`/`release/**`
и на теги `v*`:

- `versionName` — `2.0` в `app/build.gradle` (меняется вручную),
  `versionCode` — номер прогона GitHub Actions;
- debug APK — всегда, release APK — если в Secrets заведён ключ подписи;
- для ветки `release/**` создаётся предварительный релиз
  `v2.0-test-<номер прогона>` с файлами
  `AlfaSputnik-2.0-<номер>-debug.apk` и `...-release.apk`;
- финальный релиз — по тегу `v*`.

Секреты подписи Android: `RELEASE_KEYSTORE_BASE64`,
`RELEASE_KEYSTORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`.

`.github/workflows/ios.yml` — macOS-раннер (`macos-15`), собирает подписанный
IPA. В TestFlight уходит по галочке при ручном запуске или когда изменён
`.github/testflight-trigger.txt`. Секреты: `IOS_DISTRIBUTION_P12`,
`IOS_PROVISIONING_PROFILE_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`,
`ASC_KEY_P8`.

Минуты macOS считаются ×10, поэтому iOS собирается по готовности, а не
после каждой правки.

## 4. Устройство проекта

- `app/src/main/assets` — веб-приложение: `index.html`, `code.js`
  (минифицированный бандл 2015 года, 858 КБ, исходников нет — правки
  точечные), `styles.css`, `svraddr.js` (адрес сервера), картинки,
  Leaflet, Font Awesome.
- `app/src/main/java/ru/alfanomy/mapp` — `MainActivity` (WebView)
  и `MyFirebaseMessagingService` (FCM).
- `app/build.gradle` — `minSdk 23`, `targetSdk 34`, `versionName 2.0`.
- `ios/` — WKWebView-обёртка, проект генерируется XcodeGen (`project.yml`),
  подпись и загрузка — через App Store Connect API.
- `docs/privacy` — политика конфиденциальности для GitHub Pages.
- `firebase-push-server-integration.md` — задание на серверную часть push.

## 5. Сервер

- Адрес — `svraddr.js`: `http://m.alfanomy.ru/alfa-sp/mapp-1.2/server/index.jss`.
- Старая платформа: Delphi/ISAPI + Firebird; разбор протокола —
  `gmpony/telematics/docs/LEGACY_ALFANOMY.md`.
- RPC: GET с `name` и `data`, сессия в строке запроса; живое обновление —
  long-poll `update` до 120 секунд.
- Серверные скрипты мобильного клиента — ветка `web-app`, папка `web/server`
  (`index.jss`, `data-svc.js`, `stream.js`, `brand.config.js`). Они
  побайтово совпадают с боевыми: правка в репозитории = правка продакшна.
- Push: клиент вызывает `registerPushToken`, сервер передаёт токен во
  внутреннюю службу push.
- Личный кабинет `/client-portal/` — отдельное приложение на Apache 2.0.52
  + PHP 5.2.2, общая база Firebird с мобильным клиентом.

## 6. Сайт

Отдельный репозиторий `031168-sudo/alfanomy-site`, папка `www/`.
Выкладывается на Windows-сервер `193.106.95.12` в
`C:\chameleon\telematics\www`; инструкция —
`gmpony/telematics/docs/CERTIFICATE_ALFANOMY.md`.

## 7. Публикация

- RuStore: `ru.alfanomy.mapp`.
- App Store: `id6814783331`.
- Google Play не используется: старый аккаунт закрыт за неактивность,
  антифрод блокирует новый. Регистрация организации по D-U-N-S — резерв.

## 8. Принятые решения

- `code.js` не пересобираем: исходников нет, правки только точечные
  и проверяются на живом сервере.
- Новые версии ставятся поверх старых, без переустановки.
- В названии и на иконке — только Alfanomy, без упоминаний AlfaSputnik.
- Push — через Firebase Cloud Messaging на обеих платформах.

## 9. Журнал сборок

- `v2.0-test-93` (04.11.2026) — последняя тестовая сборка: APK debug
  и release.
- До неё: починен баг с обновлением экрана «Статус», сделан приём
  push-уведомлений на Android и iPhone.

## 10. Открытые вопросы

Перенесены в `BACKLOG.md`.
