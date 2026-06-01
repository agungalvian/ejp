import { Request, Response } from 'express';
import prisma from '../config/prisma';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export const getContracts = async (req: Request, res: Response) => {
  const { search, project_id } = req.query;

  const contracts = await prisma.contract.findMany({
    where: {
      ...(project_id ? { project_id: String(project_id) } : {}),
      ...(search ? {
        OR: [
          { contract_number: { contains: String(search), mode: 'insensitive' } },
          { name: { contains: String(search), mode: 'insensitive' } },
        ]
      } : {}),
    },
    include: {
      project: {
        select: {
          id: true,
          project_code: true,
          name: true,
        }
      }
    },
    orderBy: { contract_number: 'asc' },
  });

  res.json({ success: true, data: contracts });
};

export const getContractById = async (req: Request, res: Response) => {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      project: {
        select: {
          id: true,
          project_code: true,
          name: true,
        }
      }
    }
  });
  res.json({ success: true, data: contract });
};

export const createContract = async (req: Request, res: Response) => {
  const { contract_number, name, project_id, contract_value, start_date, end_date, status, description } = req.body;

  const document_path = req.file ? `/uploads/contracts/${req.file.filename}` : null;

  const contract = await prisma.contract.create({
    data: {
      contract_number,
      name,
      project_id,
      contract_value: Number(contract_value),
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      document_path,
      status: status || 'Active',
      description,
    },
    include: {
      project: {
        select: {
          id: true,
          project_code: true,
          name: true,
        }
      }
    }
  });

  res.status(201).json({ success: true, data: contract });
};

export const updateContract = async (req: Request, res: Response) => {
  const { contract_number, name, project_id, contract_value, start_date, end_date, status, description } = req.body;

  const current = await prisma.contract.findUniqueOrThrow({ where: { id: req.params.id } });

  let document_path = current.document_path;
  if (req.file) {
    document_path = `/uploads/contracts/${req.file.filename}`;
    
    // Delete old file if exists
    if (current.document_path) {
      const filename = current.document_path.split('/').pop();
      if (filename) {
        const oldPath = path.join(UPLOAD_DIR, 'contracts', filename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.error('Failed to delete old contract file:', e);
          }
        }
      }
    }
  }

  const contract = await prisma.contract.update({
    where: { id: req.params.id },
    data: {
      contract_number,
      name,
      project_id,
      contract_value: contract_value ? Number(contract_value) : undefined,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      document_path,
      status,
      description,
    },
    include: {
      project: {
        select: {
          id: true,
          project_code: true,
          name: true,
        }
      }
    }
  });

  res.json({ success: true, data: contract });
};

export const deleteContract = async (req: Request, res: Response) => {
  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: req.params.id } });

  // Delete file from disk
  if (contract.document_path) {
    const filename = contract.document_path.split('/').pop();
    if (filename) {
      const filePath = path.join(UPLOAD_DIR, 'contracts', filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to delete contract file:', e);
        }
      }
    }
  }

  await prisma.contract.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Contract deleted' });
};
