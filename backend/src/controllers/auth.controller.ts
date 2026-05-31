import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.is_active) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const payload = { id: user.id, role: user.role.name, email: user.email };
  const token = jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        permissions: user.role.permissions,
        employee_id: user.employee_id,
      },
    },
  });
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
};

export const me = async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      is_active: true,
      created_at: true,
      role: { select: { name: true, permissions: true } },
      employee_id: true,
      employee: { select: { id: true, name: true, employee_id: true } },
    },
  });

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      is_active: user.is_active,
      created_at: user.created_at,
      role: user.role.name,
      permissions: user.role.permissions,
      employee_id: user.employee_id,
      employee: user.employee,
    },
  });
};

export const refreshToken = async (req: AuthRequest, res: Response) => {
  const payload = { id: req.user!.id, role: req.user!.role, email: req.user!.email };
  const token = jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({ success: true, data: { token } });
};
