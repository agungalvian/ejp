import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { ContactType } from '@prisma/client';

export const getContacts = async (req: Request, res: Response) => {
  const { type, search } = req.query;
  const contacts = await prisma.contact.findMany({
    where: {
      ...(type ? { type: type as ContactType } : {}),
      ...(search ? { name: { contains: String(search), mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: contacts });
};

export const getContactById = async (req: Request, res: Response) => {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json({ success: true, data: contact });
};

export const createContact = async (req: Request, res: Response) => {
  const contact = await prisma.contact.create({ data: req.body });
  res.status(201).json({ success: true, data: contact });
};

export const updateContact = async (req: Request, res: Response) => {
  const contact = await prisma.contact.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: contact });
};

export const deleteContact = async (req: Request, res: Response) => {
  await prisma.contact.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Contact deleted' });
};
