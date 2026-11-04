
import { useEffect, useState } from 'react';
import { listActiveProducts } from '../api/marketplace';
import type { Product } from '@/shared/types/db';
import { ProductModal } from '../components/ProductModal';
import { ProviderProfileModal } from '../components/ProviderProfileModal';
import { useAuth } from '@/shared/hooks/useAuth';
import './marketplace.css';

type Category = 'Todos' | 'Streaming' | 'Música' | 'IA' | 'Productividad' | 'VPN y seguridad';

const categories: Category[] = [
  'Todos',
  'Streaming',
  'Música',
  'IA',
  'Productividad',
  'VPN y seguridad',
];

const catalogDesign: Record<string, {
  category: Category;
  background: string;
  foreground?: string;
  logo: string;
}> = {
  netflix: { category: 'Streaming', background: 'linear-gradient(135deg,#390000,#c60000)', logo: 'N' },
  'prime-video': { category: 'Streaming', background: 'linear-gradient(135deg,#00243d,#006baf)', logo: 'prime video' },
  'hbo-max': { category: 'Streaming', background: 'linear-gradient(135deg,#28005b,#7222cc)', logo: 'HBO max' },
  'disney-plus': { category: 'Streaming', background: 'linear-gradient(135deg,#001c49,#006be0)', logo: 'Disney+' },
  'paramount-plus': { category: 'Streaming', background: 'linear-gradient(135deg,#00358a,#0878f9)', logo: 'Paramount+' },
  vix: { category: 'Streaming', background: 'linear-gradient(135deg,#ff5800,#ff9800)', logo: 'ViX' },
  crunchyroll: { category: 'Streaming', background: 'linear-gradient(135deg,#ef5700,#ff9d00)', logo: 'crunchyroll' },
  'apple-tv-plus': { category: 'Streaming', background: 'linear-gradient(135deg,#151923,#343c4b)', logo: 'Apple TV+' },
  spotify: { category: 'Música', background: 'linear-gradient(135deg,#008d45,#1ed760)', logo: 'Spotify' },
  'youtube-music': { category: 'Música', background: 'linear-gradient(135deg,#a00000,#f21b24)', logo: 'YouTube Music' },
  'apple-music': { category: 'Música', background: 'linear-gradient(135deg,#fa2858,#fb677f)', logo: 'Apple Music' },
  chatgpt: { category: 'IA', background: 'linear-gradient(135deg,#003e3b,#0a8275)', logo: 'ChatGPT' },
  claude: { category: 'IA', background: 'linear-gradient(135deg,#e5bba1,#f5dfc8)', foreground: '#2b201b', logo: 'Claude' },
  'claude-code': { category: 'IA', background: 'linear-gradient(135deg,#171e2a,#303d52)', logo: 'Claude Code' },
  gemini: { category: 'IA', background: 'linear-gradient(135deg,#11152e,#343c82)', logo: '✦ Gemini' },
  'microsoft-365': { category: 'Productividad', background: 'linear-gradient(135deg,#1c65b4,#55b2e5)', logo: 'Microsoft 365' },
  'canva-pro': { category: 'Productividad', background: 'linear-gradient(135deg,#00b6ce,#8233e9)', logo: 'Canva' },
  nordvpn: { category: 'VPN y seguridad', background: 'linear-gradient(135deg,#083c9e,#277cff)', logo: 'NordVPN' },
  surfshark: { category: 'VPN y seguridad', background: 'linear-gradient(135deg,#007d8c,#12b9ba)', logo: 'Surfshark' },
  expressvpn: { category: 'VPN y seguridad', background: 'linear-gradient(135deg,#b80020,#f12543)', logo: 'ExpressVPN' },
};

function getDesign(product: Product) {
  return catalogDesign[product.slug] ?? {
    category: 'Todos' as Category,
    background: 'linear-gradient(135deg,#263144,#45536b)',
    logo: product.name,
  };
}

export default function MarketplacePage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setProducts(await listActiveProducts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      category === 'Todos' || getDesign(product).category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="vex-marketplace">
      <div className="vex-marketplace-heading">
        <div>
          <h1>Marketplace</h1>
          <p>Encuentra tus servicios digitales favoritos y compara ofertas.</p>
        </div>
        {profile && (
          <div className="vex-wallet">
            Tu saldo <strong>S/ {Number(profile.wallet_balance ?? 0).toFixed(2)}</strong>
          </div>
        )}
      </div>

      <div className="vex-search">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Buscar producto"
          placeholder="Buscar producto... (Netflix, Spotify, ChatGPT...)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="vex-categories">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? 'vex-category active' : 'vex-category'}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loading && <p className="vex-message">Cargando catálogo...</p>}
      {error && <p className="vex-error">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="vex-message">No encontramos productos con esos filtros.</p>
      )}

      <div className="vex-product-grid">
        {filtered.map((product) => {
          const design = getDesign(product);

          return (
            <article className="vex-product-card" key={product.id}>
              <div
                className="vex-product-banner"
                style={{
                  background: design.background,
                  color: 'foreground' in design ? design.foreground : '#fff',
                }}
              >
                <span>{design.logo}</span>
              </div>

              <div className="vex-product-content">
                <h3>{product.name}</h3>
                <span className="vex-product-category">{design.category}</span>

                <div className="vex-product-footer">
                  <small>
                    {product.product_durations?.map((d) => d.label).join(' / ') || 'Consultar planes'}
                  </small>
                  <button
                    type="button"
                    className="vex-offers-button"
                    onClick={() => setSelectedProduct(product)}
                  >
                    Ver ofertas →
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onOpenProvider={setSelectedProvider}
        onPurchased={load}
      />
      <ProviderProfileModal
        providerId={selectedProvider}
        onClose={() => setSelectedProvider(null)}
      />
    </div>
  );
}
