import { supabase } from '@/shared/lib/supabaseClient';
import type { Product, ProviderOffer } from '@/shared/types/db';

export async function listActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, category_id, name, slug, active, product_durations(id, product_id, label, days)')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function listOffersForDuration(productId: string, durationId: string): Promise<ProviderOffer[]> {
  const { data, error } = await supabase
    .from('provider_offers')
    .select(
      'id, provider_id, product_id, duration_id, price, commission_type, commission_value, status, ' +
        'providers(business_name, rating_avg, rating_count, verified), offer_stock(stock)'
    )
    .eq('product_id', productId)
    .eq('duration_id', durationId)
    .eq('status', 'activo')
    .order('price');
  if (error) throw error;
  return (data ?? []) as unknown as ProviderOffer[];
}

export function stockOf(offer: ProviderOffer): number {
  return offer.offer_stock?.[0]?.stock ?? 0;
}

export async function purchaseOffer(offerId: string, couponCode?: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_purchase_offer', {
    p_offer_id: offerId,
    p_coupon_code: couponCode || null,
  });
  if (error) throw error;
  return data as string; // order id
}
