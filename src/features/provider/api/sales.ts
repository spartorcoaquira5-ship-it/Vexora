import { supabase } from '@/shared/lib/supabaseClient';

export interface Sale {
  id: string;
  price: number;
  commission_amount: number;
  provider_amount: number;
  financial_status: string;
  retention_release_at: string;
  created_at: string;
  products?: { name: string };
  product_durations?: { label: string };
}

export async function listMySales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, price, commission_amount, provider_amount, financial_status, retention_release_at, created_at, products(name), product_durations(label)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Sale[];
}
