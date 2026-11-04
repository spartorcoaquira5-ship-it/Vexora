
import { supabase } from '@/shared/lib/supabaseClient';
import type { WalletMovement, Recharge } from '@/shared/types/db';

export async function listMovements(): Promise<WalletMovement[]> {
  const { data, error } = await supabase
    .from('wallet_movements')
    .select('id, type, amount, balance_after, description, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WalletMovement[];
}

export async function listMyRecharges(): Promise<Recharge[]> {
  const { data, error } = await supabase
    .from('recharges')
    .select('id, amount, method, status, proof_url, reference, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Recharge[];
}

export async function createRecharge(
  amount: number,
  method: 'yape' | 'binance'
) {
  const { data, error } = await supabase.rpc('fn_create_recharge', {
    p_amount: amount,
    p_proof_url: null,
    p_reference: null,
  });

  if (error) throw error;
  return data as string;
}

export async function uploadProof(
  rechargeId: string,
  file: File,
  userId: string
) {
  const path = `${userId}/${rechargeId}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('comprobantes')
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('recharges')
    .update({ proof_url: path })
    .eq('id', rechargeId);

  if (updateError) throw updateError;
}

export async function getProofSignedUrl(
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('comprobantes')
    .createSignedUrl(path, 60 * 10);

  if (error) throw error;
  return data.signedUrl;
}
