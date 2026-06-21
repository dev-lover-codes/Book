'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Fetch all inventory items for a retailer
 */
export async function getInventory(retailerId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('retailer_id', retailerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Check for items that are low in stock (quantity <= low_stock_threshold)
 */
export async function checkLowStock(retailerId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('retailer_id', retailerId);

    if (error) throw error;

    // Filter items client-side since comparing two table columns is not natively supported in PostgREST queries
    const lowStockItems = (data || []).filter(
      (item) => item.stock_quantity <= item.low_stock_threshold
    );

    return { success: true, data: lowStockItems };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Add a new item to the inventory
 */
export async function addInventoryItem(
  retailerId: string,
  item: {
    item_name: string;
    category: 'books' | 'pens' | 'notebooks' | 'art_supplies' | 'other';
    stock_quantity: number;
    cost_price: number;
    selling_price: number;
    low_stock_threshold?: number;
  }
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        retailer_id: retailerId,
        item_name: item.item_name,
        category: item.category,
        stock_quantity: item.stock_quantity,
        cost_price: item.cost_price,
        selling_price: item.selling_price,
        low_stock_threshold: item.low_stock_threshold !== undefined ? item.low_stock_threshold : 5,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Record a counter sale (which auto-decrements inventory stock via trigger)
 */
export async function addStationerySale(
  retailerId: string,
  sale: {
    item_id: number;
    quantity_sold: number;
    total_amount: number;
  }
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stationery_sales')
      .insert({
        retailer_id: retailerId,
        item_id: sale.item_id,
        quantity_sold: sale.quantity_sold,
        total_amount: sale.total_amount,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fetch counter sales history for a retailer
 */
export async function getStationerySales(retailerId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('stationery_sales')
      .select(`
        id,
        quantity_sold,
        total_amount,
        created_at,
        inventory:inventory (
          item_name,
          category,
          selling_price
        )
      `)
      .eq('retailer_id', retailerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
