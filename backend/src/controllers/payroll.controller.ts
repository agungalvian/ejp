import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { EmployeeType, PayrollPeriodStatus } from '@prisma/client';
import { processPayrollPeriod } from '../services/payrollService';
import { journalForPayrollProcessed } from '../services/journalService';
import { AuthRequest } from '../middleware/auth';

// ── Employees ─────────────────────────────────────────────────────────────────
export const getEmployees = async (req: Request, res: Response) => {
  const { type, search } = req.query;
  const employees = await prisma.employee.findMany({
    where: {
      is_active: true,
      ...(type ? { type: type as EmployeeType } : {}),
      ...(search ? { name: { contains: String(search), mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: employees });
};

export const createEmployee = async (req: Request, res: Response) => {
  const count = await prisma.employee.count();
  const employee_id = `EMP-${String(count + 1).padStart(4, '0')}`;
  const employee = await prisma.employee.create({
    data: {
      ...req.body,
      employee_id,
      join_date: req.body.join_date ? new Date(req.body.join_date) : undefined,
    },
  });
  res.status(201).json({ success: true, data: employee });
};

export const updateEmployee = async (req: Request, res: Response) => {
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: employee });
};

// ── Payroll Parameters ────────────────────────────────────────────────────────
export const getParameters = async (_req: Request, res: Response) => {
  const params = await prisma.payrollParameter.findMany({ orderBy: { type: 'asc' } });
  res.json({ success: true, data: params });
};

export const updateParameter = async (req: Request, res: Response) => {
  const param = await prisma.payrollParameter.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: param });
};

// ── Timesheets ────────────────────────────────────────────────────────────────
export const getTimesheets = async (req: AuthRequest, res: Response) => {
  const { employee_id, project_id, from_date, to_date } = req.query;

  // Lapangan role: only see their own timesheets
  let empFilter = employee_id ? { employee_id: String(employee_id) } : {};
  if (req.user?.role === 'Lapangan') {
    // Map user to employee record
    const emp = await prisma.employee.findFirst({
      where: { contact: { email: req.user.email } },
    });
    if (emp) empFilter = { employee_id: emp.id };
  }

  const timesheets = await prisma.timesheet.findMany({
    where: {
      ...empFilter,
      ...(project_id ? { project_id: String(project_id) } : {}),
      ...(from_date || to_date
        ? { date: { ...(from_date ? { gte: new Date(String(from_date)) } : {}), ...(to_date ? { lte: new Date(String(to_date)) } : {}) } }
        : {}),
    },
    include: {
      employee: { select: { name: true, employee_id: true } },
      project: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json({ success: true, data: timesheets });
};

export const createTimesheet = async (req: AuthRequest, res: Response) => {
  const { employee_id, project_id, date, check_in, check_out, hours_worked, notes } = req.body;

  // Compute hours_worked from check_in/check_out if not provided
  let hours = Number(hours_worked) || 0;
  if (check_in && check_out && !hours_worked) {
    const diff = (new Date(check_out).getTime() - new Date(check_in).getTime()) / (1000 * 60 * 60);
    hours = Math.max(0, Math.round(diff * 100) / 100);
  }

  const evidence_photo_path = req.file ? `/uploads/timesheets/${req.file.filename}` : undefined;

  const timesheet = await prisma.timesheet.upsert({
    where: { employee_id_date: { employee_id, date: new Date(date) } },
    update: { check_in: check_in ? new Date(check_in) : undefined, check_out: check_out ? new Date(check_out) : undefined, hours_worked: hours, notes, evidence_photo_path },
    create: {
      employee_id,
      project_id,
      date: new Date(date),
      check_in: check_in ? new Date(check_in) : undefined,
      check_out: check_out ? new Date(check_out) : undefined,
      hours_worked: hours,
      notes,
      evidence_photo_path,
      submitted_by_user_id: req.user?.id,
    },
  });
  res.status(201).json({ success: true, data: timesheet });
};

export const updateTimesheet = async (req: AuthRequest, res: Response) => {
  const timesheet = await prisma.timesheet.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: timesheet });
};

// ── Payroll Periods ───────────────────────────────────────────────────────────
export const getPayrollPeriods = async (_req: Request, res: Response) => {
  const periods = await prisma.payrollPeriod.findMany({
    include: { _count: { select: { payroll_details: true } } },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
  });
  res.json({ success: true, data: periods });
};

export const createPayrollPeriod = async (req: Request, res: Response) => {
  const { period_month, period_year, notes } = req.body;
  const monthNum = Number(period_month);
  const yearNum = Number(period_year);

  const existing = await prisma.payrollPeriod.findUnique({
    where: {
      period_month_period_year: {
        period_month: monthNum,
        period_year: yearNum,
      },
    },
  });

  if (existing) {
    return res.status(400).json({
      success: false,
      message: `Periode payroll untuk bulan ${monthNum} tahun ${yearNum} sudah ada.`,
    });
  }

  const period = await prisma.payrollPeriod.create({
    data: {
      period_month: monthNum,
      period_year: yearNum,
      notes,
    },
  });
  res.status(201).json({ success: true, data: period });
};

export const processPayroll = async (req: AuthRequest, res: Response) => {
  const { employee_ids } = req.body;
  const result = await processPayrollPeriod(req.params.id, employee_ids);

  // Trigger automated journal
  await journalForPayrollProcessed(req.params.id, req.user?.id);

  res.json({ success: true, data: result, message: `Payroll processed for ${result.processed} employees` });
};

export const markPayrollPaid = async (req: Request, res: Response) => {
  const period = await prisma.payrollPeriod.update({
    where: { id: req.params.id },
    data: { status: 'Paid', paid_at: new Date() },
  });
  res.json({ success: true, data: period });
};

export const getPayrollDetails = async (req: Request, res: Response) => {
  const details = await prisma.payrollDetail.findMany({
    where: { payroll_period_id: req.params.id },
    include: { employee: { select: { name: true, employee_id: true, type: true } } },
    orderBy: { employee: { name: 'asc' } },
  });
  res.json({ success: true, data: details });
};

export const updatePayrollPeriod = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { period_month, period_year, notes } = req.body;
  const monthNum = Number(period_month);
  const yearNum = Number(period_year);

  const period = await prisma.payrollPeriod.findUnique({
    where: { id },
  });

  if (!period) {
    return res.status(404).json({ success: false, message: 'Periode payroll tidak ditemukan.' });
  }

  if (period.status !== 'Draft') {
    return res.status(400).json({ success: false, message: 'Hanya periode berstatus Draft yang dapat diubah.' });
  }

  if (period.period_month !== monthNum || period.period_year !== yearNum) {
    const existing = await prisma.payrollPeriod.findUnique({
      where: {
        period_month_period_year: {
          period_month: monthNum,
          period_year: yearNum,
        },
      },
    });

    if (existing && existing.id !== id) {
      return res.status(400).json({
        success: false,
        message: `Periode payroll untuk bulan ${monthNum} tahun ${yearNum} sudah ada.`,
      });
    }
  }

  const updated = await prisma.payrollPeriod.update({
    where: { id },
    data: {
      period_month: monthNum,
      period_year: yearNum,
      notes,
    },
  });

  res.json({ success: true, data: updated });
};

export const deletePayrollPeriod = async (req: Request, res: Response) => {
  const { id } = req.params;

  const period = await prisma.payrollPeriod.findUnique({
    where: { id },
  });

  if (!period) {
    return res.status(404).json({ success: false, message: 'Periode payroll tidak ditemukan.' });
  }

  if (period.status !== 'Draft') {
    return res.status(400).json({ success: false, message: 'Hanya periode berstatus Draft yang dapat dihapus.' });
  }

  await prisma.payrollPeriod.delete({
    where: { id },
  });

  res.json({ success: true, message: 'Periode payroll berhasil dihapus.' });
};

export const rejectPayrollPeriod = async (req: Request, res: Response) => {
  const { id } = req.params;

  const period = await prisma.payrollPeriod.findUnique({
    where: { id },
  });

  if (!period) {
    return res.status(404).json({ success: false, message: 'Periode payroll tidak ditemukan.' });
  }

  if (period.status !== 'Processed') {
    return res.status(400).json({ success: false, message: 'Hanya periode berstatus Processed yang dapat dibatalkan.' });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete computed payroll details
    await tx.payrollDetail.deleteMany({
      where: { payroll_period_id: id },
    });

    // 2. Delete transaction (which cascades to journal entries)
    await tx.transaction.deleteMany({
      where: {
        source_type: 'Payroll',
        source_id: id,
      },
    });

    // 3. Revert period status to Draft
    await tx.payrollPeriod.update({
      where: { id },
      data: {
        status: 'Draft',
        processed_at: null,
      },
    });
  });

  res.json({ success: true, message: 'Periode payroll berhasil dibatalkan ke Draft.' });
};
