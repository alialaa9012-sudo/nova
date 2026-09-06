#!/usr/bin/env node
/**
 * بيولّد أمر SQL جاهز لتغيير كلمة مرور مستخدم في لوحة NOVA.
 * الاستخدام:
 *   node scripts/set-password.js owner@test.nova "كلمة-المرور-الجديدة"
 *
 * الأمر بيتطبع على الشاشة — تنسخه وتشغّله في Neon SQL Editor.
 * السكربت ده مابيتصلش بقاعدة البيانات، فمفيش أي خطر منه.
 */
import bcrypt from 'bcryptjs';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('الاستخدام: node scripts/set-password.js <email> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('كلمة المرور لازم تكون 8 أحرف على الأقل.');
  process.exit(1);
}
if (email.includes("'") || email.includes('\\')) {
  console.error('الإيميل فيه رموز غير مسموحة.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

console.log('\n--- انسخ السطر ده وشغّله في Neon SQL Editor ---\n');
console.log(`UPDATE users SET password_hash = '${hash}' WHERE lower(email) = lower('${email}');`);
console.log('\n--- بعدها ادخل اللوحة بالإيميل وكلمة المرور دي ---\n');
