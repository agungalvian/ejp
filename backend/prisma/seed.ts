import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ── Roles & Permissions ───────────────────────────────────────────────────
  const defaultRoles = [
    {
      name: 'Admin',
      description: 'Akses Administrator Penuh',
      permissions: {
        dashboard: 'write',
        projects: 'write',
        invoices: 'write',
        equipment: 'write',
        inventory: 'write',
        employees: 'write',
        timesheets: 'write',
        payroll: 'write',
        ledger: 'write',
        accounts: 'write',
        users: 'write',
      },
    },
    {
      name: 'Manajer_Proyek',
      description: 'Akses Manajer Proyek',
      permissions: {
        dashboard: 'read',
        projects: 'write',
        invoices: 'read',
        equipment: 'read',
        inventory: 'write',
        employees: 'read',
        timesheets: 'write',
        payroll: 'none',
        ledger: 'none',
        accounts: 'none',
        users: 'none',
      },
    },
    {
      name: 'Staf_Keuangan',
      description: 'Akses Keuangan & Akuntansi',
      permissions: {
        dashboard: 'write',
        projects: 'read',
        invoices: 'write',
        equipment: 'write',
        inventory: 'read',
        employees: 'write',
        timesheets: 'read',
        payroll: 'write',
        ledger: 'write',
        accounts: 'write',
        users: 'none',
      },
    },
    {
      name: 'Lapangan',
      description: 'Akses Pekerja Lapangan',
      permissions: {
        dashboard: 'read',
        projects: 'none',
        invoices: 'none',
        equipment: 'none',
        inventory: 'none',
        employees: 'none',
        timesheets: 'write',
        payroll: 'none',
        ledger: 'none',
        accounts: 'none',
        users: 'none',
      },
    },
  ];

  const roleMap = new Map<string, string>(); // name -> id

  for (const r of defaultRoles) {
    const created = await prisma.role.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions, description: r.description },
      create: { name: r.name, description: r.description, permissions: r.permissions },
    });
    roleMap.set(r.name, created.id);
  }
  console.log('✅ Default roles seeded');

  // ── Admin User ────────────────────────────────────────────────────────────
  const adminEmail = 'admin@erp.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminRoleId = roleMap.get('Admin')!;

  if (!existing) {
    await prisma.user.create({
      data: {
        name: 'System Administrator',
        email: adminEmail,
        password_hash: await bcrypt.hash('Admin@12345', 12),
        role_id: adminRoleId,
        is_active: true,
      },
    });
    console.log('✅ Admin user created: admin@erp.local / Admin@12345');
  } else {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role_id: adminRoleId },
    });
    console.log('ℹ️  Admin user linked to Admin role.');
  }

  // ── Chart of Accounts ─────────────────────────────────────────────────────
  const accounts = [
    // ASSETS
    { code: '1-0000', name: 'ASET', type: 'Asset' as const, parent_id: null },
    { code: '1-1000', name: 'Kas dan Setara Kas', type: 'Asset' as const, parentCode: '1-0000' },
    { code: '1-1100', name: 'Kas Tunai', type: 'Asset' as const, parentCode: '1-1000' },
    { code: '1-1200', name: 'Rekening Bank', type: 'Asset' as const, parentCode: '1-1000' },
    { code: '1-2000', name: 'Piutang Usaha', type: 'Asset' as const, parentCode: '1-0000' },
    { code: '1-3000', name: 'Persediaan Material', type: 'Asset' as const, parentCode: '1-0000' },
    { code: '1-4000', name: 'Aset Tetap - Alat Berat', type: 'Asset' as const, parentCode: '1-0000' },
    { code: '1-4100', name: 'Akumulasi Penyusutan Alat Berat', type: 'Asset' as const, parentCode: '1-4000' },
    // LIABILITIES
    { code: '2-0000', name: 'KEWAJIBAN', type: 'Liability' as const, parent_id: null },
    { code: '2-1000', name: 'Hutang Usaha', type: 'Liability' as const, parentCode: '2-0000' },
    { code: '2-2000', name: 'Hutang Gaji', type: 'Liability' as const, parentCode: '2-0000' },
    { code: '2-3000', name: 'Hutang Pajak', type: 'Liability' as const, parentCode: '2-0000' },
    { code: '2-3100', name: 'PPN Keluaran', type: 'Liability' as const, parentCode: '2-3000' },
    { code: '2-3200', name: 'PPh 21 Terutang', type: 'Liability' as const, parentCode: '2-3000' },
    { code: '2-4000', name: 'Uang Muka Proyek (Retensi)', type: 'Liability' as const, parentCode: '2-0000' },
    // EQUITY
    { code: '3-0000', name: 'EKUITAS', type: 'Equity' as const, parent_id: null },
    { code: '3-1000', name: 'Modal Disetor', type: 'Equity' as const, parentCode: '3-0000' },
    { code: '3-2000', name: 'Laba Ditahan', type: 'Equity' as const, parentCode: '3-0000' },
    // REVENUE
    { code: '4-0000', name: 'PENDAPATAN', type: 'Revenue' as const, parent_id: null },
    { code: '4-1000', name: 'Pendapatan Jasa Konstruksi', type: 'Revenue' as const, parentCode: '4-0000' },
    { code: '4-2000', name: 'Pendapatan Sewa Alat Berat', type: 'Revenue' as const, parentCode: '4-0000' },
    // EXPENSES
    { code: '5-0000', name: 'BEBAN', type: 'Expense' as const, parent_id: null },
    { code: '5-1000', name: 'Harga Pokok Produksi', type: 'Expense' as const, parentCode: '5-0000' },
    { code: '5-1100', name: 'Beban Material Proyek', type: 'Expense' as const, parentCode: '5-1000' },
    { code: '5-1200', name: 'Beban Upah Langsung', type: 'Expense' as const, parentCode: '5-1000' },
    { code: '5-2000', name: 'Beban Gaji & Tunjangan', type: 'Expense' as const, parentCode: '5-0000' },
    { code: '5-3000', name: 'Beban Penyusutan Alat Berat', type: 'Expense' as const, parentCode: '5-0000' },
    { code: '5-4000', name: 'Beban BPJS', type: 'Expense' as const, parentCode: '5-0000' },
    { code: '5-5000', name: 'Beban Administrasi', type: 'Expense' as const, parentCode: '5-0000' },
  ];

  // First pass: create parent accounts
  const accountMap = new Map<string, string>(); // code -> id

  // Create root accounts first
  for (const acc of accounts.filter((a) => !('parentCode' in a))) {
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: { code: acc.code, name: acc.name, type: acc.type },
    });
    accountMap.set(acc.code, created.id);
  }

  // Create child accounts
  for (const acc of accounts.filter((a) => 'parentCode' in a)) {
    const parentId = accountMap.get((acc as any).parentCode);
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: { code: acc.code, name: acc.name, type: acc.type, parent_id: parentId },
    });
    accountMap.set(acc.code, created.id);
  }

  console.log(`✅ Chart of Accounts seeded: ${accounts.length} accounts`);

  // ── Tax Parameters ────────────────────────────────────────────────────────
  const taxes = [
    { name: 'PPN 11%', rate: 0.11 },
    { name: 'PPh 22 (0.3%)', rate: 0.003 },
  ];
  for (const tax of taxes) {
    await prisma.taxParameter.upsert({
      where: { id: tax.name }, // we'll use name as a proxy; use findFirst approach
      update: {},
      create: { name: tax.name, rate: tax.rate, is_enabled: true },
    }).catch(async () => {
      const exists = await prisma.taxParameter.findFirst({ where: { name: tax.name } });
      if (!exists) await prisma.taxParameter.create({ data: { name: tax.name, rate: tax.rate, is_enabled: true } });
    });
  }
  console.log('✅ Tax parameters seeded');

  // ── Payroll Parameters ────────────────────────────────────────────────────
  const payrollParams = [
    { name: 'Uang Makan Harian', type: 'Meal_Allowance' as const, value: 30000, is_percentage: false, is_enabled: true },
    { name: 'Uang Transport Harian', type: 'Transport_Allowance' as const, value: 20000, is_percentage: false, is_enabled: true },
    { name: 'BPJS Ketenagakerjaan (3.7%)', type: 'BPJS_TK' as const, value: 0.037, is_percentage: true, is_enabled: true },
    { name: 'BPJS Kesehatan (4%)', type: 'BPJS_KES' as const, value: 0.04, is_percentage: true, is_enabled: true },
    { name: 'PPh 21 (5%)', type: 'PPh21' as const, value: 0.05, is_percentage: true, is_enabled: true },
  ];

  for (const p of payrollParams) {
    const exists = await prisma.payrollParameter.findFirst({ where: { type: p.type } });
    if (!exists) {
      await prisma.payrollParameter.create({ data: p });
    }
  }
  console.log('✅ Payroll parameters seeded');

  // ── Default Warehouse ─────────────────────────────────────────────────────
  const wh = await prisma.warehouse.findFirst({ where: { name: 'Gudang Utama' } });
  if (!wh) {
    await prisma.warehouse.create({ data: { name: 'Gudang Utama', location: 'Kantor Pusat' } });
    console.log('✅ Default warehouse created');
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('   Login: admin@erp.local / Admin@12345');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
