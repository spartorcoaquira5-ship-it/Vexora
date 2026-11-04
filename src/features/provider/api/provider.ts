import { supabase } from '@/shared/lib/supabaseClient';
import type { Provider } from '@/shared/types/db';

export async function getMyProvider(): Promise<Provider> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('providers').select('*').eq('id', auth.user!.id).single();
  if (error) throw error;
  return data as Provider;
}

export async function updateProviderProfile(businessName: string, bio: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('providers')
    .update({ business_name: businessName, bio })
    .eq('id', auth.user!.id);
  if (error) throw error;
}

export async function uploadVerificationDoc(kind: 'dni' | 'bank', file: File, userId: string): Promise<string> {
  const path = `${userId}/${kind}-${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('verificacion').upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function submitVerification(dniPath: string, bankPath: string) {
  const { error } = await supabase.rpc('fn_submit_provider_verification', {
    p_dni_path: dniPath,
    p_bank_path: bankPath,
  });
  if (error) throw error;
}

export async function getBalances(providerId: string) {
  const { data, error } = await supabase.from('provider_balances').select('*').eq('provider_id', providerId).single();
  if (error) throw error;
  return data as { retenido: number; disponible: number; reservado: number; retirado: number };
}

export async function getTier(providerId: string) {
  const { data, error } = await supabase.from('provider_tier').select('*').eq('provider_id', providerId).single();
  if (error) throw error;
  return data as { tier: string; sales: number; rating: number; no_claim_rate: number };
}

export async function getResponseHours(providerId: string) {
  const { data } = await supabase.from('provider_response_hours').select('*').eq('provider_id', providerId).maybeSingle();
  return data as { avg_hours: number; claims_considered: number } | null;
}
