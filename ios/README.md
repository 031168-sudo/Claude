# Alfanomy (iOS)

WKWebView-обёртка, показывающая тот же веб-апп, что и Android-версия
(`web/` — копия `app/src/main/assets` из Android-проекта; в бандл копируется
скриптом сборки как папка `web/`. Не переименовывать в `Resources` — это имя
ломает подпись iOS-приложения).

## Сборка

`.xcodeproj` не хранится в репозитории — генерируется из `project.yml` через
[XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd ios
xcodegen generate
open Alfanomy.xcodeproj
```

CI (`.github/workflows/ios.yml`) делает то же самое на `macos` раннере GitHub
Actions и пока собирает только под симулятор (подписи ещё нет).

## Что нужно сделать вручную, прежде чем собирать боевой билд для iPhone/TestFlight

1. **Зарегистрировать iOS-приложение в Firebase** (тот же проект, что и для
   Android, `alfanomy-android`): Firebase Console → Project Settings →
   Add app → iOS, Bundle ID `ru.alfanomy.mapp`. Скачать
   `GoogleService-Info.plist` и положить в `ios/Alfanomy/` (аналог
   `app/google-services.json` в Android-проекте, тоже коммитится в репозиторий).

2. **Загрузить APNs-ключ в Firebase** (без этого push не будет работать на
   iOS, даже с правильным GoogleService-Info.plist): Apple Developer →
   Certificates, Identifiers & Profiles → Keys → создать ключ с APNs, скачать
   `.p8`. Затем Firebase Console → Project Settings → Cloud Messaging →
   Apple app configuration → загрузить этот ключ.

3. **Подпись для реального устройства/TestFlight**: Bundle ID
   `ru.alfanomy.mapp` нужно зарегистрировать в Apple Developer, выпустить
   Distribution-сертификат и Provisioning Profile. Как с Android-подписью,
   это заводится как секреты в GitHub Actions, не хранится в репозитории.

## Известное отличие от Android по push-уведомлениям

Серверная интеграция (см. `firebase-push-server-integration.md` в корне
репозитория) была сделана из расчёта на Android: пуш шлётся только с
`data`-полем, без `notification`, потому что так Android показывает
уведомление, даже когда приложение полностью закрыто. Для iOS этого
недостаточно: чисто `data`-пуш iPhone не покажет. Сервер должен добавлять в
сообщение блок `apns.payload.aps.alert` — пример есть в
`firebase-push-server-integration.md`, раздел 6. Android этот блок
игнорирует, поэтому его можно слать всем токенам сразу.

Веб-часть регистрирует токен на сервере с `platform: "android"` и на iOS
тоже (значение зашито в `web/code.js`); для отправки с блоком `apns` это
не мешает.
