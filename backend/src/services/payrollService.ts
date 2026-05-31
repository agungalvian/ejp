import prisma from '../config/prisma';
import { EmployeeType } from '@prisma/client';

interface PayrollCalculation {
  employee_id: string;
  working_days: number;
  basic_salary: number;
  meal_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  gross_salary: number;
  bpjs_tk: number;
  bpjs_kes: number;
  pph21: number;
  total_deductions: number;
  net_salary: number;
}

/**
 * Parameterized payroll engine.
 *
 * Rules:
 *  - Meal/Transport allowances: multiplied by working_days ONLY if is_enabled = true
 *  - BPJS_TK, BPJS_KES, PPh21: applied as percentage of gross ONLY if is_enabled = true
 *  - Parameters filter by applies_to_type (null = applies to all employee types)
 */
export async function calculatePayroll(
  employeeId: string,
  workingDays: number,
  periodMonth: number,
  periodYear: number
): Promise<PayrollCalculation> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const params = await prisma.payrollParameter.findMany();

  // Filter parameters applicable to this employee type
  const applicable = params.filter(
    (p) => p.applies_to_type === null || p.applies_to_type === employee.type
  );

  const getParam = (type: string) => applicable.find((p) => p.type === type);

  const basicSalary = Number(employee.base_salary);

  // ── Allowances (daily rate × working days, only if enabled) ───────────────
  const mealParam = getParam('Meal_Allowance');
  const meal = mealParam?.is_enabled ? Number(mealParam.value) * workingDays : 0;

  const transportParam = getParam('Transport_Allowance');
  const transport = transportParam?.is_enabled ? Number(transportParam.value) * workingDays : 0;

  const grossSalary = basicSalary + meal + transport;

  // ── Deductions (percentage of gross, only if enabled) ─────────────────────
  const bpjsTKParam = getParam('BPJS_TK');
  const bpjsTK = bpjsTKParam?.is_enabled && bpjsTKParam.is_percentage
    ? grossSalary * Number(bpjsTKParam.value)
    : 0;

  const bpjsKesParam = getParam('BPJS_KES');
  const bpjsKes = bpjsKesParam?.is_enabled && bpjsKesParam.is_percentage
    ? grossSalary * Number(bpjsKesParam.value)
    : 0;

  const pph21Param = getParam('PPh21');
  const pph21 = pph21Param?.is_enabled && pph21Param.is_percentage
    ? grossSalary * Number(pph21Param.value)
    : 0;

  const totalDeductions = bpjsTK + bpjsKes + pph21;
  const netSalary = grossSalary - totalDeductions;

  return {
    employee_id: employeeId,
    working_days: workingDays,
    basic_salary: basicSalary,
    meal_allowance: meal,
    transport_allowance: transport,
    other_allowances: 0,
    gross_salary: grossSalary,
    bpjs_tk: bpjsTK,
    bpjs_kes: bpjsKes,
    pph21,
    total_deductions: totalDeductions,
    net_salary: netSalary,
  };
}

/**
 * Count working days for an employee in a given period based on their timesheets.
 */
export async function countWorkingDays(
  employeeId: string,
  periodMonth: number,
  periodYear: number
): Promise<number> {
  const startDate = new Date(periodYear, periodMonth - 1, 1);
  const endDate = new Date(periodYear, periodMonth, 0); // last day of month

  const timesheets = await prisma.timesheet.count({
    where: {
      employee_id: employeeId,
      date: { gte: startDate, lte: endDate },
      hours_worked: { gt: 0 },
    },
  });

  return timesheets;
}

/**
 * Process an entire payroll period — calculates details for all active employees
 * and upserts PayrollDetail records.
 */
export async function processPayrollPeriod(
  payrollPeriodId: string,
  employeeIds?: string[]
): Promise<{ processed: number; total_net: number }> {
  const period = await prisma.payrollPeriod.findUniqueOrThrow({
    where: { id: payrollPeriodId },
  });

  if (period.status === 'Paid') {
    throw new Error('Cannot re-process a Paid payroll period');
  }

  const whereClause = employeeIds?.length
    ? { id: { in: employeeIds }, is_active: true }
    : { is_active: true };

  const employees = await prisma.employee.findMany({ where: whereClause });

  let totalNet = 0;
  let processed = 0;

  for (const emp of employees) {
    const workingDays = await countWorkingDays(emp.id, period.period_month, period.period_year);
    const calc = await calculatePayroll(emp.id, workingDays, period.period_month, period.period_year);

    await prisma.payrollDetail.upsert({
      where: { payroll_period_id_employee_id: { payroll_period_id: payrollPeriodId, employee_id: emp.id } },
      update: {
        working_days: calc.working_days,
        basic_salary: calc.basic_salary,
        meal_allowance: calc.meal_allowance,
        transport_allowance: calc.transport_allowance,
        gross_salary: calc.gross_salary,
        bpjs_tk: calc.bpjs_tk,
        bpjs_kes: calc.bpjs_kes,
        pph21: calc.pph21,
        total_deductions: calc.total_deductions,
        net_salary: calc.net_salary,
      },
      create: {
        payroll_period_id: payrollPeriodId,
        employee_id: emp.id,
        working_days: calc.working_days,
        basic_salary: calc.basic_salary,
        meal_allowance: calc.meal_allowance,
        transport_allowance: calc.transport_allowance,
        gross_salary: calc.gross_salary,
        bpjs_tk: calc.bpjs_tk,
        bpjs_kes: calc.bpjs_kes,
        pph21: calc.pph21,
        total_deductions: calc.total_deductions,
        net_salary: calc.net_salary,
      },
    });

    totalNet += calc.net_salary;
    processed++;
  }

  // Update period status to Processed
  await prisma.payrollPeriod.update({
    where: { id: payrollPeriodId },
    data: { status: 'Processed', processed_at: new Date() },
  });

  return { processed, total_net: totalNet };
}
