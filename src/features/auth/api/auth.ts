import { supabase } from '@/shared/lib/supabaseClient';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpClient(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

/**
 * Registra una cuenta y, en el mismo flujo, la convierte en proveedor.
 *
 * Nota: si tu proyecto tiene "Confirm email" activado en Auth, la sesión
 * no queda activa hasta que el usuario confirme su correo — en ese caso
 * fn_become_provider no se puede llamar todavía (no hay auth.uid()).
 * Para desarrollo rápido, puedes desactivar la confirmación de correo en
 * Authentication -> Providers -> Email, o adaptar este flujo para llamar
 * fn_become_provider justo después del primer login confirmado.
 */
export async function signUpProvider(
  email: string,
  password: string,
  fullName: string,
  businessName: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;

  if (data.session) {
    const { error: rpcError } = await supabase.rpc('fn_become_provider', {
      p_business_name: businessName,
    });
    if (rpcError) throw rpcError;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
