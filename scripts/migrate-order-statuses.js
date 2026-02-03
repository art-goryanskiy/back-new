/**
 * Миграция статусов заказов: старые значения → новые.
 *
 * Запуск из корня проекта:
 *   MONGODB_URI=mongodb://... node scripts/migrate-order-statuses.js
 * Или с загрузкой .env (если установлен dotenv):
 *   npx dotenv -e .env -- node scripts/migrate-order-statuses.js
 */
const mongoose = require('mongoose');

const STATUS_MAP = {
  DRAFT: 'AWAITING_PAYMENT',
  SUBMITTED: 'AWAITING_PAYMENT',
  PAYMENT_PENDING: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  DOCUMENTS_GENERATED: 'IN_PROGRESS',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      'Задайте MONGODB_URI в окружении (например: export MONGODB_URI="mongodb://mongo:27017/education-center")',
    );
    process.exit(1);
  }

  await mongoose.connect(uri);
  const coll = mongoose.connection.db.collection('orders');

  let totalModified = 0;
  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    if (oldStatus === newStatus) continue;
    const result = await coll.updateMany(
      { status: oldStatus },
      { $set: { status: newStatus } },
    );
    if (result.modifiedCount > 0) {
      console.log(`  ${oldStatus} → ${newStatus}: ${result.modifiedCount}`);
      totalModified += result.modifiedCount;
    }
  }

  if (totalModified === 0) {
    console.log('Заказов со старыми статусами не найдено (или уже мигрированы).');
  } else {
    console.log(`Всего обновлено заказов: ${totalModified}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
