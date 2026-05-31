import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { EquipmentStatus } from '@prisma/client';
import { journalForDepreciation } from '../services/journalService';
import { AuthRequest } from '../middleware/auth';

// ── Equipment ─────────────────────────────────────────────────────────────────
export const getEquipment = async (req: Request, res: Response) => {
  const { status, search } = req.query;
  const equipment = await prisma.heavyEquipment.findMany({
    where: {
      ...(status ? { status: status as EquipmentStatus } : {}),
      ...(search ? { name: { contains: String(search), mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: equipment });
};

export const getEquipmentById = async (req: Request, res: Response) => {
  const equipment = await prisma.heavyEquipment.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      rental_logs: { include: { project: { select: { name: true } } }, orderBy: { start_date: 'desc' }, take: 10 },
      asset_depreciations: { orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }], take: 12 },
    },
  });
  res.json({ success: true, data: equipment });
};

export const createEquipment = async (req: Request, res: Response) => {
  const count = await prisma.heavyEquipment.count();
  const asset_code = `ALP-${String(count + 1).padStart(4, '0')}`;
  const equipment = await prisma.heavyEquipment.create({
    data: {
      ...req.body,
      asset_code,
      current_book_value: req.body.acquisition_cost,
      acquisition_date: new Date(req.body.acquisition_date),
    },
  });
  res.status(201).json({ success: true, data: equipment });
};

export const updateEquipment = async (req: Request, res: Response) => {
  const equipment = await prisma.heavyEquipment.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: equipment });
};

// ── Rental Logs ────────────────────────────────────────────────────────────────
export const getRentalLogs = async (req: Request, res: Response) => {
  const logs = await prisma.rentalLog.findMany({
    where: { equipment_id: req.params.id },
    include: { project: { select: { name: true } } },
    orderBy: { start_date: 'desc' },
  });
  res.json({ success: true, data: logs });
};

export const createRentalLog = async (req: Request, res: Response) => {
  const { project_id, operator_name, start_date, hour_meter_start, rate_per_hour, notes } = req.body;

  // Mark equipment as Rented
  await prisma.heavyEquipment.update({
    where: { id: req.params.id },
    data: { status: 'Rented' },
  });

  const log = await prisma.rentalLog.create({
    data: {
      equipment_id: req.params.id,
      project_id,
      operator_name,
      start_date: new Date(start_date),
      hour_meter_start,
      rate_per_hour,
      notes,
    },
  });
  res.status(201).json({ success: true, data: log });
};

export const closeRentalLog = async (req: Request, res: Response) => {
  const { hour_meter_end, end_date } = req.body;
  const log = await prisma.rentalLog.findUniqueOrThrow({ where: { id: req.params.logId } });

  const hour_meter_used = Number(hour_meter_end) - Number(log.hour_meter_start);
  const total_cost = hour_meter_used * Number(log.rate_per_hour);

  const updated = await prisma.rentalLog.update({
    where: { id: req.params.logId },
    data: {
      hour_meter_end,
      hour_meter_used,
      total_cost,
      end_date: end_date ? new Date(end_date) : new Date(),
    },
  });

  // Return equipment to Available
  await prisma.heavyEquipment.update({
    where: { id: req.params.id },
    data: { status: 'Available' },
  });

  res.json({ success: true, data: updated });
};

// ── Depreciation ──────────────────────────────────────────────────────────────
export const getDepreciations = async (req: Request, res: Response) => {
  const depreciations = await prisma.assetDepreciation.findMany({
    where: { equipment_id: req.params.id },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
  });
  res.json({ success: true, data: depreciations });
};

export const runDepreciation = async (req: AuthRequest, res: Response) => {
  const { month, year, equipment_ids } = req.body;

  const whereClause = equipment_ids?.length
    ? { id: { in: equipment_ids }, status: { not: 'Retired' as EquipmentStatus } }
    : { status: { not: 'Retired' as EquipmentStatus } };

  const equipment = await prisma.heavyEquipment.findMany({ where: whereClause });
  const results: Array<{ equipment: string; depreciation: number; book_value_after: number }> = [];

  for (const eq of equipment) {
    // Skip if already depreciated this period
    const existing = await prisma.assetDepreciation.findUnique({
      where: { equipment_id_period_month_period_year: { equipment_id: eq.id, period_month: month, period_year: year } },
    });
    if (existing) continue;

    const monthlyDep = Number(eq.acquisition_cost) / (eq.useful_life_years * 12);
    const newBookValue = Math.max(0, Number(eq.current_book_value) - monthlyDep);

    const dep = await prisma.assetDepreciation.create({
      data: {
        equipment_id: eq.id,
        period_month: month,
        period_year: year,
        depreciation_amount: monthlyDep,
        book_value_after: newBookValue,
      },
    });

    await prisma.heavyEquipment.update({
      where: { id: eq.id },
      data: { current_book_value: newBookValue },
    });

    // Automated journal
    await journalForDepreciation(eq.id, monthlyDep, month, year, req.user?.id);

    results.push({ equipment: eq.name, depreciation: monthlyDep, book_value_after: newBookValue });
  }

  res.json({ success: true, data: results, count: results.length });
};
