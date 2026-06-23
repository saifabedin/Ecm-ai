// backend/scripts/seed-plans.cjs
const dotenv = require('dotenv');
const { join } = require('path');
dotenv.config({ path: join(__dirname, '../.env') });

const pool = require('../db/client.cjs');

async function seedPlans() {
  const plans = [
    { plan_id: 'starter', name: 'Starter', price_monthly: 2999, features: { ai_receptionist: true, leads_per_month: 200, whatsapp: true, calendar: true } },
    { plan_id: 'growth',  name: 'Growth',  price_monthly: 5999, features: { ai_receptionist: true, leads_per_month: 1000, whatsapp: true, calendar: true, crm: true, campaigns: true } },
    { plan_id: 'pro',     name: 'Pro',     price_monthly: 9999, features: { ai_receptionist: true, leads_per_month: -1, whatsapp: true, calendar: true, crm: true, campaigns: true, video_studio: true, ai_team: true } },
  ];

  for (const p of plans) {
    await pool.query(`
      INSERT INTO plans (plan_id, name, display_name, price_monthly, features)
      VALUES ($1, $2, $2, $3, $4)
      ON CONFLICT (plan_id) DO UPDATE
        SET name = EXCLUDED.name,
            price_monthly = EXCLUDED.price_monthly,
            features = EXCLUDED.features
    `, [p.plan_id, p.name, p.price_monthly, JSON.stringify(p.features)]);
    console.log(`✅ Plan seeded: ${p.name} (₹${p.price_monthly}/mo)`);
  }
  await pool.end();
}

seedPlans().catch(e => { console.error(e); process.exit(1); });
