import { supabase } from '@/shared/lib/supabaseClient';
import type { Order } from '@/shared/types/db';

export async function listMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, client_id, offer_id, provider_id, product_id, duration_id, price, commission_amount, provider_amount, ' +
        'status, financial_status, created_at, products(name), product_durations(label), providers(business_name)'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Order[];
}

export async function getCredentials(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_get_inventory_credentials', { p_order_id: orderId });
  if (error) throw error;
  return data as string;
}

export async function hasReview(orderId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function hasClaim(orderId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('claims')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
