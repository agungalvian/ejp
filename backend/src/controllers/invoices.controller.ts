import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { journalForInvoicePaid } from '../services/journalService';
import { AuthRequest } from '../middleware/auth';

// ── Invoices ──────────────────────────────────────────────────────────────────
export const getInvoices = async (req: Request, res: Response) => {
  const { project_id, status, type } = req.query;
  const invoices = await prisma.projectInvoice.findMany({
    where: {
      ...(project_id ? { project_id: String(project_id) } : {}),
      ...(status ? { status: status as InvoiceStatus } : {}),
      ...(type ? { invoice_type: type as InvoiceType } : {}),
    },
    include: {
      project: { select: { id: true, name: true, project_code: true } },
      invoice_taxes: { include: { tax_parameter: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, data: invoices });
};

export const getInvoiceById = async (req: Request, res: Response) => {
  const invoice = await prisma.projectInvoice.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      project: true,
      invoice_taxes: { include: { tax_parameter: true } },
    },
  });
  res.json({ success: true, data: invoice });
};

export const createInvoice = async (req: Request, res: Response) => {
  const { project_id, invoice_type, amount, due_date, notes, tax_ids } = req.body;

  // Fetch project for parameterized logic
  const project = await prisma.project.findUniqueOrThrow({ where: { id: project_id } });

  // Down Payment: validate against project DP percentage
  let finalAmount = Number(amount);
  if (invoice_type === 'Down_Payment') {
    const dpPct = Number(project.down_payment_percentage);
    if (dpPct <= 0) {
      res.status(422).json({ success: false, message: 'This project has no down payment configured' });
      return;
    }
    // Use configured percentage if amount not explicitly provided
    if (!amount) finalAmount = Number(project.contract_value) * (dpPct / 100);
  }

  // Compute taxes
  let taxTotal = 0;
  const taxLines: { tax_parameter_id: string; computed_amount: number }[] = [];

  if (tax_ids?.length) {
    const taxes = await prisma.taxParameter.findMany({ where: { id: { in: tax_ids }, is_enabled: true } });
    for (const t of taxes) {
      const computed = finalAmount * Number(t.rate);
      taxTotal += computed;
      taxLines.push({ tax_parameter_id: t.id, computed_amount: computed });
    }
  }

  // Generate invoice number
  const count = await prisma.projectInvoice.count();
  const invoice_number = `INV-${project.project_code}-${String(count + 1).padStart(3, '0')}`;

  const invoice = await prisma.projectInvoice.create({
    data: {
      invoice_number,
      project_id,
      invoice_type,
      amount: finalAmount,
      tax_total: taxTotal,
      total_amount: finalAmount + taxTotal,
      due_date: due_date ? new Date(due_date) : undefined,
      notes,
      invoice_taxes: { create: taxLines },
    },
    include: { invoice_taxes: { include: { tax_parameter: true } } },
  });

  res.status(201).json({ success: true, data: invoice });
};

export const updateInvoiceStatus = async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const invoiceId = req.params.id;

  const current = await prisma.projectInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (current.status === 'Paid') {
    res.status(422).json({ success: false, message: 'Invoice is already Paid' });
    return;
  }

  const evidence_file_path = req.file
    ? `/uploads/invoices/${req.file.filename}`
    : current.evidence_file_path;

  const invoice = await prisma.projectInvoice.update({
    where: { id: invoiceId },
    data: {
      status: status as InvoiceStatus,
      paid_date: status === 'Paid' ? new Date() : undefined,
      evidence_file_path,
    },
  });

  // ── Trigger automated journal when invoice is marked Paid ─────────────────
  if (status === 'Paid') {
    await journalForInvoicePaid(invoiceId, req.user?.id);
  }

  res.json({ success: true, data: invoice });
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const invoice = await prisma.projectInvoice.findUniqueOrThrow({ where: { id: req.params.id } });
  if (invoice.status === 'Paid') {
    res.status(422).json({ success: false, message: 'Cannot delete a Paid invoice' });
    return;
  }
  await prisma.projectInvoice.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Invoice deleted' });
};

// ── Tax Parameters ────────────────────────────────────────────────────────────
export const getTaxParameters = async (_req: Request, res: Response) => {
  const taxes = await prisma.taxParameter.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: taxes });
};

export const createTaxParameter = async (req: Request, res: Response) => {
  const tax = await prisma.taxParameter.create({ data: req.body });
  res.status(201).json({ success: true, data: tax });
};

export const updateTaxParameter = async (req: Request, res: Response) => {
  const tax = await prisma.taxParameter.update({ where: { id: req.params.taxId }, data: req.body });
  res.json({ success: true, data: tax });
};
