import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';

// =============================================================================
// USERS CRUD
// =============================================================================
export const getUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role_id: true,
      role: { select: { name: true } },
      employee_id: true,
      employee: { select: { name: true, employee_id: true } },
      is_active: true,
      created_at: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: users });
};

export const getUserById = async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role_id: true,
      employee_id: true,
      is_active: true,
      created_at: true,
    },
  });
  res.json({ success: true, data: user });
};

export const createUser = async (req: Request, res: Response) => {
  const { name, email, password, role_id, employee_id } = req.body;
  const password_hash = await bcrypt.hash(password, 12);
  
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password_hash,
      role_id,
      employee_id: employee_id || null,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role_id: true,
      employee_id: true,
      is_active: true,
    },
  });
  res.status(201).json({ success: true, data: user });
};

export const updateUser = async (req: Request, res: Response) => {
  const { name, email, role_id, employee_id, is_active, password } = req.body;
  
  const updateData: any = {
    name,
    email,
    role_id,
    employee_id: employee_id || null,
    is_active,
  };
  
  if (password) {
    updateData.password_hash = await bcrypt.hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role_id: true,
      employee_id: true,
      is_active: true,
    },
  });
  res.json({ success: true, data: user });
};

export const deleteUser = async (req: Request, res: Response) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { is_active: false } });
  res.json({ success: true, message: 'User dinonaktifkan' });
};

// =============================================================================
// ROLES CRUD
// =============================================================================
export const getRoles = async (_req: Request, res: Response) => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: roles });
};

export const createRole = async (req: Request, res: Response) => {
  const { name, description, permissions } = req.body;
  
  // Prevent duplicate names
  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) {
    return res.status(400).json({ success: false, message: `Role dengan nama ${name} sudah ada.` });
  }

  const role = await prisma.role.create({
    data: { name, description, permissions },
  });
  res.status(201).json({ success: true, data: role });
};

export const updateRole = async (req: Request, res: Response) => {
  const { name, description, permissions } = req.body;
  
  // Protect default Admin role name/integrity
  const roleToEdit = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id } });
  if (roleToEdit.name === 'Admin' && name !== 'Admin') {
    return res.status(400).json({ success: false, message: 'Nama role Admin tidak boleh diubah.' });
  }

  const role = await prisma.role.update({
    where: { id: req.params.id },
    data: { name, description, permissions },
  });
  res.json({ success: true, data: role });
};

export const deleteRole = async (req: Request, res: Response) => {
  const role = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id } });

  // Prevent deleting system default roles
  const systemRoles = ['Admin', 'Manajer_Proyek', 'Staf_Keuangan', 'Lapangan'];
  if (systemRoles.includes(role.name)) {
    return res.status(400).json({ success: false, message: 'Role sistem default tidak boleh dihapus.' });
  }

  // Prevent deleting roles with active users assigned
  const userCount = await prisma.user.count({ where: { role_id: req.params.id } });
  if (userCount > 0) {
    return res.status(400).json({ success: false, message: 'Role tidak boleh dihapus karena masih memiliki user aktif.' });
  }

  await prisma.role.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Role berhasil dihapus.' });
};

// =============================================================================
// UNLINKED EMPLOYEES
// =============================================================================
/**
 * Retrieve active employees that do not have a user account linked,
 * plus optionally including the employee currently linked to a specific user (for edit form support).
 */
export const getUnlinkedEmployees = async (req: Request, res: Response) => {
  const { current_user_id } = req.query;

  let currentEmployeeId: string | null = null;
  if (current_user_id) {
    const user = await prisma.user.findUnique({
      where: { id: String(current_user_id) },
      select: { employee_id: true },
    });
    currentEmployeeId = user?.employee_id || null;
  }

  const unlinked = await prisma.employee.findMany({
    where: {
      is_active: true,
      OR: [
        { user: null },
        ...(currentEmployeeId ? [{ id: currentEmployeeId }] : []),
      ],
    },
    select: { id: true, name: true, employee_id: true },
    orderBy: { name: 'asc' },
  });

  res.json({ success: true, data: unlinked });
};
