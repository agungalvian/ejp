import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  getEmployees, createEmployee, updateEmployee,
  getParameters, updateParameter,
  getTimesheets, createTimesheet, updateTimesheet,
  getPayrollPeriods, createPayrollPeriod, processPayroll, markPayrollPaid,
  getPayrollDetails, updatePayrollPeriod, deletePayrollPeriod, rejectPayrollPeriod,
} from '../controllers/payroll.controller';

const router = Router();
router.use(authenticate);

// Employees
router.get('/employees', getEmployees);
router.post('/employees', authorize('Admin', 'Staf_Keuangan'), createEmployee);
router.put('/employees/:id', authorize('Admin', 'Staf_Keuangan'), updateEmployee);

// Parameters
router.get('/parameters', getParameters);
router.put('/parameters/:id', authorize('Admin'), updateParameter);

// Timesheets — Lapangan can create their own
router.get('/timesheets', getTimesheets);
router.post('/timesheets', upload.single('evidence'), createTimesheet);
router.put('/timesheets/:id', authorize('Admin', 'Manajer_Proyek', 'Lapangan'), updateTimesheet);

// Payroll Periods
router.get('/periods', getPayrollPeriods);
router.post('/periods', authorize('Admin', 'Staf_Keuangan'), createPayrollPeriod);
router.put('/periods/:id', authorize('Admin', 'Staf_Keuangan'), updatePayrollPeriod);
router.delete('/periods/:id', authorize('Admin', 'Staf_Keuangan'), deletePayrollPeriod);
router.post('/periods/:id/process', authorize('Admin', 'Staf_Keuangan'), processPayroll);
router.post('/periods/:id/reject', authorize('Admin', 'Staf_Keuangan'), rejectPayrollPeriod);
router.patch('/periods/:id/paid', authorize('Admin', 'Staf_Keuangan'), markPayrollPaid);
router.get('/periods/:id/details', getPayrollDetails);

export default router;
