/**
 * Создать пользователя с ролью администратора.
 *
 * Запуск из корня проекта:
 *   MONGODB_URI=mongodb://... node scripts/create-admin-user.js <email>
 * Или с .env:
 *   npx dotenv -e .env -- node scripts/create-admin-user.js <email>
 *
 * Пароль генерируется случайно и выводится в консоль (один раз).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const COLLECTION = 'users';
const ROLE_ADMIN = 'admin';

function normalizeEmail(email) {
  const v = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw new Error('Invalid email');
  }
  return v;
}

function randomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function run() {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error('Usage: node scripts/create-admin-user.js <email>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Задайте MONGODB_URI в окружении.');
    process.exit(1);
  }

  const email = normalizeEmail(emailArg);
  const plainPassword = randomPassword(12);
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await mongoose.connect(uri);
  const coll = mongoose.connection.db.collection(COLLECTION);

  const existing = await coll.findOne({ email });
  if (existing) {
    if (existing.role === ROLE_ADMIN) {
      console.log(`Пользователь ${email} уже существует и является администратором.`);
    } else {
      const r = await coll.updateOne(
        { email },
        { $set: { role: ROLE_ADMIN, updatedAt: new Date() } },
      );
      if (r.modifiedCount) {
        console.log(`Роль пользователя ${email} обновлена на администратор.`);
      }
    }
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  await coll.insertOne({
    email,
    password: passwordHash,
    role: ROLE_ADMIN,
    isBlocked: false,
    isEmailVerified: true,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Создан администратор: ${email}`);
  console.log(`Временный пароль (сохраните): ${plainPassword}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
