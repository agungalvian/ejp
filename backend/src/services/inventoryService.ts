import prisma from '../config/prisma';

export interface StockOutItem {
  material_id: string;
  warehouse_id: string;
  quantity: number;
  unit_cost: number;
  rab_budget_id?: string;
}

/**
 * Validate stock availability before Stock_Out.
 * Throws HTTP 422-compatible error if any item is under-stocked.
 */
export async function validateStockOut(items: StockOutItem[]): Promise<void> {
  const errors: string[] = [];

  for (const item of items) {
    const stock = await prisma.inventoryStock.findUnique({
      where: {
        material_id_warehouse_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
        },
      },
      include: { material: true, warehouse: true },
    });

    if (!stock) {
      errors.push(`Material '${item.material_id}' not found in warehouse '${item.warehouse_id}'`);
      continue;
    }

    if (Number(stock.stock_quantity) < item.quantity) {
      errors.push(
        `Insufficient stock for '${stock.material.name}' in '${stock.warehouse.name}': ` +
        `available=${stock.stock_quantity}, requested=${item.quantity}`
      );
    }
  }

  if (errors.length > 0) {
    const err: any = new Error(`Stock validation failed:\n${errors.join('\n')}`);
    err.status = 422;
    throw err;
  }
}

/**
 * Deduct stock quantities after a validated Stock_Out.
 * Must be called after validateStockOut passes.
 */
export async function deductStock(items: StockOutItem[]): Promise<void> {
  for (const item of items) {
    await prisma.inventoryStock.update({
      where: {
        material_id_warehouse_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
        },
      },
      data: {
        stock_quantity: { decrement: item.quantity },
      },
    });
  }
}

/**
 * Add stock quantities for Stock_In.
 */
export async function addStock(
  items: { material_id: string; warehouse_id: string; quantity: number }[]
): Promise<void> {
  for (const item of items) {
    await prisma.inventoryStock.upsert({
      where: {
        material_id_warehouse_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
        },
      },
      update: { stock_quantity: { increment: item.quantity } },
      create: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        stock_quantity: item.quantity,
      },
    });
  }
}

/**
 * Transfer stock between warehouses: deduct from source, add to destination.
 */
export async function transferStock(
  items: { material_id: string; quantity: number },
  fromWarehouseId: string,
  toWarehouseId: string
): Promise<void> {
  await validateStockOut([{ ...items, warehouse_id: fromWarehouseId, unit_cost: 0 }]);
  await deductStock([{ ...items, warehouse_id: fromWarehouseId, unit_cost: 0 }]);
  await addStock([{ ...items, warehouse_id: toWarehouseId }]);
}

/**
 * Update RAB actual_cost when materials are issued to a project.
 */
export async function updateRabActualCost(
  rabBudgetId: string,
  additionalCost: number
): Promise<void> {
  await prisma.rabBudget.update({
    where: { id: rabBudgetId },
    data: { actual_cost: { increment: additionalCost } },
  });
}
