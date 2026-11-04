import { supabase } from '@/shared/lib/supabaseClient';
import type { Claim, ClaimMessage } from '@/shared/types/db';

export async function listClaims(): Promise<Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('id, order_id, client_id, provider_id, reason, description, status, resolution_type, created_at, orders(products(name)), providers(business_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Claim[];
}

export async function listClaimMessages(claimId: string): Promise<ClaimMessage[]> {
  const { data, error } = await supabase
    .from('claim_messages')
    .select('id, claim_id, sender_id, message, created_at')
    .eq('claim_id', claimId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as ClaimMessage[];
}

export async function createClaim(orderId: string, reason: string, description: string) {
  const { error } = await supabase.from('claims').insert({
    order_id: orderId,
    reason,
    description,
    client_id: (await supabase.auth.getUser()).data.user?.id,
  });
  if (error) throw error;
}

export async function addClaimMessage(claimId: string, message: string) {
  const { error } = await supabase.from('claim_messages').insert({
    claim_id: claimId,
    message,
    sender_id: (await supabase.auth.getUser()).data.user?.id,
  });
  if (error) throw error;
  // si responde el proveedor, pasa a en_revision (el cliente no puede, RLS lo exige)
  await supabase.from('claims').update({ status: 'en_revision' }).eq('id', claimId).eq('status', 'abierto');
}

export async function resolveClaim(claimId: string, resolutionType: 'reembolso_cliente' | 'liberar_proveedor', notes?: string) {
  const { error } = await supabase.rpc('fn_resolve_claim', {
    p_claim_id: claimId,
    p_resolution_type: resolutionType,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}
