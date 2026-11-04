import { supabase } from '@/shared/lib/supabaseClient';
import type { Notification } from '@/shared/types/db';

export async function listMyNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, read, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markRead(id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}
