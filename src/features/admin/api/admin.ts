import { supabase } from '@/shared/lib/supabaseClient';

// ---------- Productos ----------
export async function listAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category_id, active, categories(name), product_durations(id, label, days)')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listCategories() {
  const { data, error } = await supabase.from('categories').select('id, name, slug');
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(name: string, categoryId: string, durations: { label: string; days: number }[]) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { data: product, error } = await supabase
    .from('products')
    .insert({ name, slug, category_id: categoryId, active: true })
    .select('id')
    .single();
  if (error) throw error;
  const { error: durError } = await supabase
    .from('product_durations')
    .insert(durations.map((d) => ({ product_id: product.id, label: d.label, days: d.days })));
  if (durError) throw durError;
}

export async function toggleProductActive(productId: string, active: boolean) {
  const { error } = await supabase
    .from('products')
    .update({ active })
    .eq('id', productId);

  if (error) throw error;
}

// ---------- Recargas ----------
export async function listAllRecharges() {
  const { data, error } = await supabase
    .from('recharges')
    .select(`
      id,
      client_id,
      amount,
      method,
      status,
      proof_url,
      created_at,
      profiles!recharges_client_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function confirmRecharge(id: string) {
  const { error } = await supabase.rpc('fn_confirm_recharge', { p_recharge_id: id });
  if (error) throw error;
}

export async function rejectRecharge(id: string, reason?: string) {
  const { error } = await supabase.rpc('fn_reject_recharge', { p_recharge_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function getRechargeProofUrl(path: string) {
  const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

// ---------- Retiros ----------
export async function listAllWithdrawals() {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id, provider_id, amount, status, created_at, providers(business_name), withdrawal_methods(type, details)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function approveWithdrawal(id: string) {
  const { error } = await supabase.rpc('fn_approve_withdrawal', { p_withdrawal_id: id });
  if (error) throw error;
}

export async function rejectWithdrawal(id: string, reason?: string) {
  const { error } = await supabase.rpc('fn_reject_withdrawal', { p_withdrawal_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function markWithdrawalPaid(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_mark_withdrawal_paid', { p_withdrawal_id: id });
  if (error) throw error;
  return data as string; // código generado
}

// ---------- Proveedores ----------
export async function listAllProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('id, business_name, verified, verification_status, verification_note, dni_proof_path, bank_statement_proof_path, sales_count')
    .order('business_name');
  if (error) throw error;
  return data ?? [];
}

export async function reviewVerification(providerId: string, approve: boolean, note?: string) {
  const { error } = await supabase.rpc('fn_review_provider_verification', {
    p_provider_id: providerId,
    p_approve: approve,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function getVerificationDocUrl(path: string) {
  const { data, error } = await supabase.storage.from('verificacion').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function toggleVerified(providerId: string, verified: boolean) {
  await supabase.from('providers').update({ verified }).eq('id', providerId);
}

// ---------- Cupones ----------
export async function listCoupons() {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCoupon(code: string, type: 'porcentaje' | 'monto_fijo', value: number, maxUses: number) {
  const { error } = await supabase.rpc('fn_create_coupon', {
    p_code: code, p_type: type, p_value: value, p_max_uses: maxUses, p_product_id: null,
  });
  if (error) throw error;
}

export async function sendCouponToClient(couponId: string, clientId: string) {
  const { error } = await supabase.rpc('fn_send_coupon_to_client', { p_coupon_id: couponId, p_client_id: clientId });
  if (error) throw error;
}

export async function listClients() {
  const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'cliente');
  if (error) throw error;
  return data ?? [];
}
export type CardTestAttempt = {
  id: string;
  client_id: string;
  full_name: string | null;
  amount: number;
  last_four: string;
  card_brand: string;
  result: string;
  created_at: string;
};

export async function listCardTestAttempts(): Promise<CardTestAttempt[]> {
  const { data, error } = await supabase.rpc(
    'fn_admin_card_test_attempts'
  );

  if (error) throw error;

  return (data ?? []) as CardTestAttempt[];
}
