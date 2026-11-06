
import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  getMyProvider,
  updateProviderProfile,
  uploadVerificationDoc,
  submitVerification,
  getTier,
  getResponseHours,
} from '../api/provider';
import type { Provider } from '@/shared/types/db';
import { StatusPill } from '@/shared/components/StatusPill';
import './provider-profile.css';

type TierInfo = {
  tier: string;
  sales: number;
};

export default function ProviderProfilePage() {
  const { profile } = useAuth();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [tier, setTier] = useState<TierInfo | null>(null);
  const [responseHours, setResponseHours] = useState<number | null>(null);

  const [dniFile, setDniFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVerification, setSavingVerification] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  async function load(updateForm = true) {
    setLoadError(null);

    try {
      const p = await getMyProvider();

      setProvider(p);

      if (updateForm) {
        setBusinessName(p.business_name ?? '');
        setBio(p.bio ?? '');
      }

      const [tierResult, responseResult] = await Promise.allSettled([
        getTier(p.id),
        getResponseHours(p.id),
      ]);

      setTier(
        tierResult.status === 'fulfilled'
          ? tierResult.value
          : null,
      );

      setResponseHours(
        responseResult.status === 'fulfilled'
          ? responseResult.value?.avg_hours ?? null
          : null,
      );
    } catch (err) {
      console.error('Error cargando perfil:', err);
      setLoadError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el perfil.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProfile() {
    if (savingProfile || savingVerification) return;

    setProfileError(null);
    setProfileMessage(null);

    if (!businessName.trim()) {
      setProfileError('Ingresa el nombre de tu negocio.');
      return;
    }

    setSavingProfile(true);

    try {
      await updateProviderProfile(businessName.trim(), bio);
      setProfileMessage('Los datos de tu negocio se guardaron correctamente.');
      await load(false);
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el perfil.',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSubmitVerification() {
    if (savingProfile || savingVerification) return;

    setVerificationError(null);
    setVerificationMessage(null);

    if (!profile || !dniFile || !bankFile) {
      setVerificationError(
        'Adjunta ambos documentos: DNI y extracto bancario.',
      );
      return;
    }

    setSavingVerification(true);

    try {
      const dniPath = await uploadVerificationDoc(
        'dni',
        dniFile,
        profile.id,
      );

      const bankPath = await uploadVerificationDoc(
        'bank',
        bankFile,
        profile.id,
      );

      await submitVerification(dniPath, bankPath);

      setDniFile(null);
      setBankFile(null);

      setVerificationMessage(
        'Documentos enviados correctamente. Quedan en revisión.',
      );

      await load(false);
    } catch (err) {
      setVerificationError(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar la verificación.',
      );
    } finally {
      setSavingVerification(false);
    }
  }

  const responseText =
    responseHours == null
      ? 'Sin datos aún'
      : responseHours < 1
        ? `~${Math.round(responseHours * 60)} min`
        : `~${Math.round(responseHours)} h`;

  if (loading && !provider) {
    return (
      <div className="vprofile">
        <div className="vprofile-loading">
          Cargando información de tu perfil...
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="vprofile">
        <div className="vprofile-alert vprofile-alert-error">
          {loadError ?? 'No se pudo cargar el perfil.'}
          <button type="button" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const initial = (businessName.trim() || 'V').charAt(0).toUpperCase();

  return (
    <div className="vprofile">
      <header className="vprofile-page-header">
        <div>
          <span className="vprofile-eyebrow">VEXORA · VENDEDOR</span>
          <h1>Mi perfil</h1>
          <p>Administra la información y verificación de tu negocio.</p>
        </div>

        <button
          type="button"
          className="vprofile-refresh"
          onClick={() => void load(false)}
          disabled={loading || savingProfile || savingVerification}
        >
          ↻ Actualizar
        </button>
      </header>

      {loadError && (
        <div className="vprofile-alert vprofile-alert-error">
          {loadError}
        </div>
      )}

      <section className="vprofile-hero">
        <div className="vprofile-hero-main">
          <div className="vprofile-avatar">{initial}</div>

          <div className="vprofile-business">
            <span className="vprofile-eyebrow">PERFIL COMERCIAL</span>
            <h2>{provider.business_name || 'Mi negocio'}</h2>
            <p>
              {provider.bio || 'Tu espacio de ventas en VEXORA.'}
            </p>

            <div className="vprofile-badges">
              {provider.verified ? (
                <span className="vprofile-badge vprofile-badge-verified">
                  ✓ Verificado
                </span>
              ) : (
                <span className="vprofile-badge vprofile-badge-pending">
                  Verificación pendiente
                </span>
              )}

              {tier && (
                <span className="vprofile-badge vprofile-badge-tier">
                  ★ {tier.tier}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="vprofile-hero-footer">
          <div>
            <span>Ventas registradas</span>
            <strong>{tier?.sales ?? '—'}</strong>
          </div>

          <div>
            <span>Tiempo de respuesta</span>
            <strong>{responseText}</strong>
          </div>

          <div>
            <span>Estado de la cuenta</span>
            <strong>
              {provider.verified ? 'Verificada' : 'Por verificar'}
            </strong>
          </div>
        </div>
      </section>

      <div className="vprofile-grid">
        <section className="vprofile-card">
          <div className="vprofile-card-heading">
            <div className="vprofile-heading-icon">✓</div>
            <div>
              <h2>Verificación de identidad</h2>
              <p>
                Gestiona los documentos de verificación de tu cuenta.
              </p>
            </div>
          </div>

          <div className="vprofile-verification-info">
            <strong>Verificación de vendedor</strong>
            <p>
              Para poder vender necesitas enviar tu DNI y un extracto
              bancario reciente. Un administrador los revisa manualmente.
            </p>
          </div>

          {provider.verified ? (
            <div className="vprofile-verification-status">
              <StatusPill status="confirmada" />
              <p>
                Tu identidad ha sido verificada correctamente.
              </p>
            </div>
          ) : provider.verification_status === 'pendiente' ? (
            <div className="vprofile-verification-status">
              <StatusPill status="pendiente" />
              <p>
                Tus documentos están pendientes de revisión.
              </p>
            </div>
          ) : (
            <>
              {provider.verification_status === 'rechazada' && (
                <div className="vprofile-alert vprofile-alert-error">
                  <strong>Verificación rechazada</strong>
                  <p>
                    {provider.verification_note ||
                      'Revisa tus documentos y vuelve a enviarlos.'}
                  </p>
                </div>
              )}

              <div className="vprofile-upload-grid">
                <div className="vprofile-upload">
                  <label htmlFor="vprofile-dni">
                    Documento de identidad (DNI)
                  </label>
                  <p>Imagen o archivo PDF.</p>
                  <input
                    id="vprofile-dni"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) =>
                      setDniFile(event.target.files?.[0] ?? null)
                    }
                  />
                  {dniFile && (
                    <small>Seleccionado: {dniFile.name}</small>
                  )}
                </div>

                <div className="vprofile-upload">
                  <label htmlFor="vprofile-bank">
                    Extracto bancario
                  </label>
                  <p>Documento bancario reciente.</p>
                  <input
                    id="vprofile-bank"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) =>
                      setBankFile(event.target.files?.[0] ?? null)
                    }
                  />
                  {bankFile && (
                    <small>Seleccionado: {bankFile.name}</small>
                  )}
                </div>
              </div>

              {verificationError && (
                <div className="vprofile-alert vprofile-alert-error">
                  {verificationError}
                </div>
              )}

              {verificationMessage && (
                <div className="vprofile-alert vprofile-alert-success">
                  {verificationMessage}
                </div>
              )}

              <button
                type="button"
                className="vprofile-primary"
                disabled={savingVerification || savingProfile}
                onClick={() => void handleSubmitVerification()}
              >
                {savingVerification
                  ? 'Enviando documentos...'
                  : 'Enviar para verificación'}
              </button>
            </>
          )}
        </section>

        <section className="vprofile-card">
          <div className="vprofile-card-heading">
            <div className="vprofile-heading-icon">▣</div>
            <div>
              <h2>Datos del negocio</h2>
              <p>Personaliza la información comercial de tu tienda.</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveProfile();
            }}
          >
            <div className="vprofile-field">
              <label htmlFor="vprofile-business-name">
                Nombre del negocio
              </label>
              <input
                id="vprofile-business-name"
                type="text"
                value={businessName}
                onChange={(event) => {
                  setBusinessName(event.target.value);
                  setProfileMessage(null);
                }}
                placeholder="Nombre de tu negocio"
                required
              />
            </div>

            <div className="vprofile-field">
              <label htmlFor="vprofile-bio">
                Descripción
              </label>
              <textarea
                id="vprofile-bio"
                rows={5}
                value={bio}
                onChange={(event) => {
                  setBio(event.target.value);
                  setProfileMessage(null);
                }}
                placeholder="Cuéntales a tus clientes sobre tu negocio..."
              />
              <small>
                Describe los productos o servicios que ofreces.
              </small>
            </div>

            {profileError && (
              <div className="vprofile-alert vprofile-alert-error">
                {profileError}
              </div>
            )}

            {profileMessage && (
              <div className="vprofile-alert vprofile-alert-success">
                {profileMessage}
              </div>
            )}

            <div className="vprofile-form-footer">
              <span>Los cambios se guardarán en tu perfil.</span>

              <button
                type="submit"
                className="vprofile-primary"
                disabled={savingProfile || savingVerification}
              >
                {savingProfile
                  ? 'Guardando...'
                  : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
