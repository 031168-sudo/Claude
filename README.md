# Alfanomy (mapp)

Android-обёртка (WebView) для веб-интерфейса GPS-мониторинга `m.alfanomy.ru`.
Пакет: `ru.alfanomy.mapp`.

## Состав

- `app/src/main/assets` — веб-приложение (HTML/JS/CSS), которое грузится в WebView.
  `code.js` — минифицированный бандл клиентской логики (сборка 2015 года), правки
  в него вносятся точечно через `git diff`, без пересборки бандла из исходников
  (исходников бандла в репозитории нет).
- `app/src/main/java/ru/alfanomy/mapp` — нативная часть: `MainActivity` (WebView)
  и `MyFirebaseMessagingService` (push-уведомления через Firebase Cloud Messaging).
- `firebase-push-server-integration.md` — что нужно доделать на сервере
  (`alfanomy.ru`), чтобы push-уведомления реально отправлялись. Серверного кода
  в этом репозитории нет.
- `keystore/debug.keystore` — стандартный debug-ключ для debug-сборок.

## Сборка

CI (`.github/workflows/android.yml`) собирает debug APK на каждый пуш в
`main`/`master` и кладёт его в артефакты сборки.

## История

Раньше проект хранился как zip-архив, который распаковывался в CI на лету —
без истории изменений исходников и без возможности осмысленного отката.
Начиная с ветки `restructure/unpack-project` источники распакованы и
версионируются обычным образом.
