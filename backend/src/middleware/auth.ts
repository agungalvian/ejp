import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    permissions?: any;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Support both cookie and Authorization header (Bearer token)
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    });
    
    if (!dbUser || !dbUser.is_active) {
      res.status(401).json({ success: false, message: 'User is inactive or deleted' });
      return;
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role.name,
      permissions: dbUser.role.permissions,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Role-based guard factory (Legacy compatibility).
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
};

/**
 * Permission-based guard factory.
 * Usage: router.get('/route', authenticate, authorizePermission('projects', 'read'), handler)
 */
export const authorizePermission = (menu: string, access: 'read' | 'write') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Admin role bypasses permission checks (master access)
    if (req.user.role === 'Admin') {
      next();
      return;
    }

    const permissions = req.user.permissions || {};
    const userAccess = permissions[menu] || 'none';

    if (userAccess === 'none') {
      res.status(403).json({
        success: false,
        message: `Access denied. No permission for: ${menu}`,
      });
      return;
    }

    if (access === 'write' && userAccess !== 'write') {
      res.status(403).json({
        success: false,
        message: `Access denied. Write access required for: ${menu}`,
      });
      return;
    }

    next();
  };
};
