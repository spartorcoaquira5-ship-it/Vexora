import { supabase } from '@/shared/lib/supabaseClient';
import type { WithdrawalMethod, Withdrawal } from '@/shared/types/db';

export async function listMyMethods(providerId: string): Promise<WithdrawalMethod[]> {
  const { data, error } = await supabase.from('withdrawal_methods').select('*').eq('provider_id', providerId);
  if (error) throw error;
  return (data ?? []) as WithdrawalMethod[];
}

export async function addMethod(providerId: string, type: 'yape' | 'plin' | 'cuenta_bancaria', details: Record<string, string>) {
  const { error } = await supabase.from('withdrawal_methods').insert({ provider_id: providerId, type, details });
  if (error) throw error;
}

export async function listMyWithdrawals(): Promise<Withdrawal[]> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id, amount, status, code, created_at, withdrawal_methods(type, details)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Withdrawal[];
}

export async function requestWithdrawal(amount: number, methodId: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_request_withdrawal', { p_amount: amount, p_method_id: methodId });
  if (error) throw error;
  return data as string;
}

export async function redeemCode(code: string) {
  const { error } = await supabase.rpc('fn_redeem_withdrawal_code', { p_code: code });
  if (error) throw error;
}
