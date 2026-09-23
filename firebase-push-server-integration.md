# Push-уведомления (FCM): что нужно добавить на сервере alfanomy.ru

Ниже — референс-реализация на Node.js. Она не привязана к конкретному фреймворку
(Express/Koa/что-то своё) специально, чтобы её было легко вставить в существующий
код. Все места, которые нужно адаптировать под реальную структуру проекта, помечены `// TODO`.

## 1. Установка

```bash
npm install firebase-admin
```

## 2. Получить ключ сервисного аккаунта Firebase

Firebase Console → Project Settings → Service Accounts → **Generate new private key**.
Скачается JSON-файл (НЕ путать с `google-services.json` из Android-проекта — это другой файл,
только для сервера). Храните его вне репозитория (например, переменная окружения или secrets-хранилище).

## 3. Инициализация Firebase Admin SDK

```js
// firebase.js
const admin = require('firebase-admin');

// Вариант А: путь к файлу ключа через переменную окружения
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
```

## 4. Хранение токенов устройств

Нужна таблица/коллекция, связывающая **пользователя** (или сессию/логин) с одним
или несколькими FCM-токенами (пользователь может быть залогинен на нескольких
телефонах).

```sql
-- пример для SQL; для Mongo/etc. - аналогичная структура документа
CREATE TABLE push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(16) NOT NULL DEFAULT 'android',
  created_at TIMESTAMP DEFAULT now(),
  last_seen_at TIMESTAMP DEFAULT now()
);
```

## 5. Новый RPC-метод: `registerPushToken`

Приложение шлёт запрос в существующий JSON RPC-эндпоинт (тот же, куда идут
`login`/`update`/`command`), просто с `name: "registerPushToken"`:

```json
{ "name": "registerPushToken", "data": { "token": "...", "platform": "android" } }
```

Обработчик (встраивается туда же, где сейчас лежат обработчики `login`/`update`):

```js
// TODO: замените getUserIdBySid на то, как у вас сейчас резолвится
// пользователь по параметру sid в query string существующих запросов
async function handleRegisterPushToken(sid, data) {
  const userId = await getUserIdBySid(sid);
  if (!userId) {
    return { error: 1, errorMessage: 'Not authorized' };
  }

  const { token, platform } = data || {};
  if (!token) {
    return { error: 1, errorMessage: 'token is required' };
  }

  // upsert: обновляем last_seen_at, если токен уже есть (например, у другого user_id
  // после переустановки на другом аккаунте - логично привязать к последнему логину)
  await db.query(
    `INSERT INTO push_tokens (user_id, token, platform, last_seen_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (token) DO UPDATE SET user_id = $1, last_seen_at = now()`,
    [userId, token, platform || 'android']
  );

  return { error: 0 };
}

// TODO: подключить в общий диспетчер RPC-методов рядом с login/update/command:
// case 'registerPushToken': return handleRegisterPushToken(sid, data);
```

## 6. Отправка push при получении нового сигнала

Это главная часть. Нужно найти место в коде, где сервер **уже** обрабатывает
входящее сообщение от трекера (Queclink) и кладёт его в `signalStreams`,
доступный клиентам через `update`. Сразу после этого нужно дополнительно
отправить push всем пользователям, у которых есть доступ к этому устройству.

```js
const admin = require('./firebase');

// TODO: замените getUserIdsByDeviceCid на реальный запрос:
// "все user_id, у которых в contracts есть этот cid"
async function getUserIdsByDeviceCid(cid) {
  const rows = await db.query(
    `SELECT DISTINCT user_id FROM contracts WHERE device_cid = $1`,
    [cid]
  );
  return rows.map(r => r.user_id);
}

async function getPushTokensByUserIds(userIds) {
  if (!userIds.length) return [];
  const rows = await db.query(
    `SELECT token FROM push_tokens WHERE user_id = ANY($1)`,
    [userIds]
  );
  return rows.map(r => r.token);
}

async function sendSignalPushNotification(cid, deviceName, sevenSignal) {
  const userIds = await getUserIdsByDeviceCid(cid);
  const tokens = await getPushTokensByUserIds(userIds);
  if (!tokens.length) return;

  const title = deviceName || 'Alfanomy';
  const body = 'Новое сообщение от устройства';

  // ВАЖНО: для Android - только "data" payload (без "notification"), чтобы
  // приложение показывало уведомление само даже когда полностью закрыто
  // (Android доставляет data-сообщения в FirebaseMessagingService.onMessageReceived
  // даже без открытого приложения, если только устройство не в глубоком Doze).
  //
  // Для iOS data-сообщения недостаточно: iPhone покажет уведомление только
  // если в нём есть блок apns.payload.aps.alert. Блок "apns" применяется
  // только к iOS-токенам, Android его игнорирует - поэтому его можно
  // смело слать всем токенам разом, не разделяя их по платформе.
  const message = {
    data: {
      title,
      body,
      cid: String(cid),
      messageId: String(sevenSignal.MESSAGE_ID || ''),
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
        },
      },
    },
    tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Чистим невалидные/просроченные токены (переустановка, разлогин и т.п.)
  const invalidTokens = [];
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(tokens[i]);
      }
    }
  });
  if (invalidTokens.length) {
    await db.query(`DELETE FROM push_tokens WHERE token = ANY($1)`, [invalidTokens]);
  }
}

// TODO: вызвать sendSignalPushNotification(cid, deviceName, sevenSignal)
// сразу после того места, где новый сигнал от устройства принят и сохранён
// (то же самое место, откуда клиентский "update" начинает его видеть).
```

## 7. Частота / дребезг

Трекеры могут слать несколько сообщений подряд за короткое время (например,
трек + событие). Если не хочется заваливать пользователя уведомлениями на
каждое GPS-сообщение, имеет смысл фильтровать: слать push только для
определённых типов сообщений (например, только "alert"/тревожные события,
а не рядовые точки трека). Это решается на уровне того, что передаётся в
`sendSignalPushNotification` - можно добавить проверку типа сообщения перед
вызовом.

## Итого, что нужно сделать на сервере

1. `npm install firebase-admin`, положить service account key.
2. Таблица `push_tokens`.
3. RPC-метод `registerPushToken`.
4. Вызов отправки push сразу после приёма нового сигнала от устройства.
