import { supabase } from '@/shared/lib/supabaseClient';

export interface MyOffer {
  id: string;
  product_id: string;
  duration_id: string;
  price: number;
  commission_type: 'porcentaje' | 'monto_fijo';
  commission_value: number;
  products?: { name: string };
  product_durations?: { label: string };
}

export async function listActiveProductsForProvider() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, product_durations(id, label, days)')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listMyOffers(providerId: string): Promise<MyOffer[]> {
  const { data, error } = await supabase
    .from('provider_offers')
    .select('id, product_id, duration_id, price, commission_type, commission_value, products(name), product_durations(label)')
    .eq('provider_id', providerId);
  if (error) throw error;
  return (data ?? []) as unknown as MyOffer[];
}

export async function stockForOffer(offerId: string): Promise<number> {
  const { data } = await supabase.from('offer_stock').select('stock').eq('offer_id', offerId).maybeSingle();
  return data?.stock ?? 0;
}

/** Crea (o reutiliza) la oferta y agrega una cuenta con N perfiles disponibles. */
export async function addInventory(params: {
  providerId: string;
  productId: string;
  durationId: string;
  price: number;
  email: string;
  password: string;
  profileCount: number;
}) {
  const { providerId, productId, durationId, price, email, password, profileCount } = params;

  // 1) buscar o crear la oferta
  let offerId: string;
  const { data: existing } = await supabase
    .from('provider_offers')
    .select('id')
    .eq('provider_id', providerId)
    .eq('product_id', productId)
    .eq('duration_id', durationId)
    .maybeSingle();

  if (existing) {
    offerId = existing.id;
    await supabase.from('provider_offers').update({ price }).eq('id', offerId);
  } else {
    const { data: created, error: createError } = await supabase
      .from('provider_offers')
      .insert({ provider_id: providerId, product_id: productId, duration_id: durationId, price, commission_type: 'porcentaje', commission_value: 15 })
      .select('id')
      .single();
    if (createError) throw createError;
    offerId = created.id;
  }

  // 2) crear la cuenta contenedora (credenciales van a secret_ref de cada perfil; el campo
  //    credentials_encrypted de la cuenta solo guarda una referencia/etiqueta, nunca el texto
  //    plano — en un entorno real se cifra desde una Edge Function antes de llegar aquí)
  const { data: account, error: accError } = await supabase
    .from('inventory_accounts')
    .insert({ provider_id: providerId, offer_id: offerId, type: 'cuenta', label: email, max_units: profileCount })
    .select('id')
    .single();
  if (accError) throw accError;

  // 3) crear los perfiles/unidades vendibles
  const units = Array.from({ length: profileCount }, (_, i) => ({
    account_id: account.id,
    offer_id: offerId,
    provider_id: providerId,
    type: 'perfil' as const,
    label: `Perfil ${i + 1}`,
    secret_ref: `${email} / ${password} / Perfil ${i + 1}`,
    status: 'disponible' as const,
  }));
  const { error: unitsError } = await supabase.from('inventory_units').insert(units);
  if (unitsError) throw unitsError;
}
