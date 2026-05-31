import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { ProjectStatus } from '@prisma/client';

// ── Projects ──────────────────────────────────────────────────────────────────
export const getProjects = async (req: Request, res: Response) => {
  const { status, search } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status: status as ProjectStatus } : {}),
      ...(search ? { name: { contains: String(search), mode: 'insensitive' } } : {}),
    },
    include: { contact: { select: { id: true, name: true } }, _count: { select: { invoices: true, rab_budgets: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, data: projects });
};

export const getProjectById = async (req: Request, res: Response) => {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      contact: true,
      rab_budgets: { orderBy: { created_at: 'asc' } },
      invoices: { orderBy: { created_at: 'desc' } },
      rental_logs: { include: { equipment: { select: { name: true, asset_code: true } } } },
    },
  });
  res.json({ success: true, data: project });
};

const parseDecimal = (val: any, defaultVal: number = 0) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
};

export const createProject = async (req: Request, res: Response) => {
  const {
    name, contact_id, contract_value, down_payment_percentage,
    retention_percentage, start_date, end_date, description,
  } = req.body;

  const count = await prisma.project.count();
  const project_code = `PRJ-${String(count + 1).padStart(4, '0')}`;

  const project = await prisma.project.create({
    data: {
      project_code,
      name,
      contact_id,
      contract_value: parseDecimal(contract_value, 0),
      down_payment_percentage: parseDecimal(down_payment_percentage, 0),
      retention_percentage: parseDecimal(retention_percentage, 0),
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      description,
    },
    include: { contact: { select: { id: true, name: true } } },
  });
  res.status(201).json({ success: true, data: project });
};

export const updateProject = async (req: Request, res: Response) => {
  const data = { ...req.body };

  if (data.contract_value !== undefined) data.contract_value = parseDecimal(data.contract_value, 0);
  if (data.down_payment_percentage !== undefined) data.down_payment_percentage = parseDecimal(data.down_payment_percentage, 0);
  if (data.retention_percentage !== undefined) data.retention_percentage = parseDecimal(data.retention_percentage, 0);
  if (data.start_date) data.start_date = new Date(data.start_date);
  if (data.end_date) data.end_date = new Date(data.end_date);

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data,
    include: { contact: { select: { id: true, name: true } } },
  });
  res.json({ success: true, data: project });
};

export const deleteProject = async (req: Request, res: Response) => {
  await prisma.project.update({ where: { id: req.params.id }, data: { status: 'Cancelled' } });
  res.json({ success: true, message: 'Project cancelled' });
};

// ── RAB Budgets ───────────────────────────────────────────────────────────────
export const getRabBudgets = async (req: Request, res: Response) => {
  const budgets = await prisma.rabBudget.findMany({
    where: { project_id: req.params.id },
    orderBy: { created_at: 'asc' },
  });
  // Compute budget_total for each line
  const data = budgets.map((b) => ({
    ...b,
    budget_total: Number(b.qty) * Number(b.unit_price),
    variance: Number(b.qty) * Number(b.unit_price) - Number(b.actual_cost),
  }));
  res.json({ success: true, data });
};

export const createRabBudget = async (req: Request, res: Response) => {
  const budget = await prisma.rabBudget.create({
    data: { ...req.body, project_id: req.params.id },
  });
  res.status(201).json({ success: true, data: budget });
};

export const updateRabBudget = async (req: Request, res: Response) => {
  const budget = await prisma.rabBudget.update({
    where: { id: req.params.rabId },
    data: req.body,
  });
  res.json({ success: true, data: budget });
};

export const deleteRabBudget = async (req: Request, res: Response) => {
  await prisma.rabBudget.delete({ where: { id: req.params.rabId } });
  res.json({ success: true, message: 'RAB item deleted' });
};
