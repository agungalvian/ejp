import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { MaterialTransactionType } from '@prisma/client';
import { validateStockOut, deductStock, addStock, transferStock, updateRabActualCost } from '../services/inventoryService';
import { journalForStockOut } from '../services/journalService';
import { AuthRequest } from '../middleware/auth';

// ── Materials ─────────────────────────────────────────────────────────────────
export const getMaterials = async (req: Request, res: Response) => {
  const { search } = req.query;
  const materials = await prisma.material.findMany({
    where: search ? { name: { contains: String(search), mode: 'insensitive' } } : {},
    include: { account: { select: { code: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: materials });
};

export const createMaterial = async (req: Request, res: Response) => {
  const count = await prisma.material.count();
  const code = `MAT-${String(count + 1).padStart(4, '0')}`;
  const material = await prisma.material.create({ data: { ...req.body, code } });
  res.status(201).json({ success: true, data: material });
};

export const updateMaterial = async (req: Request, res: Response) => {
  const material = await prisma.material.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: material });
};

// ── Warehouses ────────────────────────────────────────────────────────────────
export const getWarehouses = async (_req: Request, res: Response) => {
  const warehouses = await prisma.warehouse.findMany({
    where: { is_active: true },
    include: { _count: { select: { inventory_stocks: true } } },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: warehouses });
};

export const createWarehouse = async (req: Request, res: Response) => {
  const warehouse = await prisma.warehouse.create({ data: req.body });
  res.status(201).json({ success: true, data: warehouse });
};

// ── Stocks ────────────────────────────────────────────────────────────────────
export const getStocks = async (req: Request, res: Response) => {
  const { warehouse_id, material_id } = req.query;
  const stocks = await prisma.inventoryStock.findMany({
    where: {
      ...(warehouse_id ? { warehouse_id: String(warehouse_id) } : {}),
      ...(material_id ? { material_id: String(material_id) } : {}),
    },
    include: {
      material: { select: { code: true, name: true, unit: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { material: { name: 'asc' } },
  });
  res.json({ success: true, data: stocks });
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const getTransactions = async (req: Request, res: Response) => {
  const { type, project_id, from_date, to_date } = req.query;
  const transactions = await prisma.materialTransaction.findMany({
    where: {
      ...(type ? { type: type as MaterialTransactionType } : {}),
      ...(project_id ? { project_id: String(project_id) } : {}),
      ...(from_date || to_date
        ? {
            date: {
              ...(from_date ? { gte: new Date(String(from_date)) } : {}),
              ...(to_date ? { lte: new Date(String(to_date)) } : {}),
            },
          }
        : {}),
    },
    include: {
      details: { include: { material: { select: { name: true, unit: true } } } },
      project: { select: { name: true } },
      from_warehouse: { select: { name: true } },
      to_warehouse: { select: { name: true } },
      created_by: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json({ success: true, data: transactions });
};

export const createTransaction = async (req: AuthRequest, res: Response) => {
  const { type, date, project_id, from_warehouse_id, to_warehouse_id, notes, details } = req.body;

  const parsedDetails: Array<{
    material_id: string; warehouse_id?: string; quantity: number; unit_cost: number; rab_budget_id?: string;
  }> = typeof details === 'string' ? JSON.parse(details) : details;

  // ── Stock_Out validation (422 if insufficient) ─────────────────────────────
  if (type === 'Stock_Out') {
    const stockItems = parsedDetails.map((d) => ({
      material_id: d.material_id,
      warehouse_id: from_warehouse_id,
      quantity: d.quantity,
      unit_cost: d.unit_cost,
      rab_budget_id: d.rab_budget_id,
    }));
    await validateStockOut(stockItems); // throws 422 if insufficient
  }

  // Create the transaction
  const tx = await prisma.materialTransaction.create({
    data: {
      type,
      date: new Date(date),
      project_id,
      from_warehouse_id,
      to_warehouse_id,
      notes,
      created_by_user_id: req.user?.id,
      details: {
        create: parsedDetails.map((d) => ({
          material_id: d.material_id,
          quantity: d.quantity,
          unit_cost: d.unit_cost,
          rab_budget_id: d.rab_budget_id,
        })),
      },
    },
    include: {
      details: { include: { material: true } },
    },
  });

  // ── Post-create stock adjustments ─────────────────────────────────────────
  if (type === 'Stock_In') {
    await addStock(parsedDetails.map((d) => ({ material_id: d.material_id, warehouse_id: to_warehouse_id!, quantity: d.quantity })));
  } else if (type === 'Stock_Out') {
    await deductStock(parsedDetails.map((d) => ({ material_id: d.material_id, warehouse_id: from_warehouse_id!, quantity: d.quantity, unit_cost: d.unit_cost })));

    // Update RAB actual costs
    for (const d of parsedDetails) {
      if (d.rab_budget_id) {
        await updateRabActualCost(d.rab_budget_id, d.quantity * d.unit_cost);
      }
    }

    // Trigger automated journal entry
    await journalForStockOut(tx.id, req.user?.id);
  } else if (type === 'Stock_Transfer') {
    for (const d of parsedDetails) {
      await transferStock({ material_id: d.material_id, quantity: d.quantity }, from_warehouse_id!, to_warehouse_id!);
    }
  }

  res.status(201).json({ success: true, data: tx });
};
