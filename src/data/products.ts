import type { Product } from '../types/product';

/**
 * Seed product catalog.
 *
 * Replace this with data from Firestore later — just keep the `Product`
 * shape consistent. Images use Unsplash placeholders; swap for your own
 * uploads (e.g. Firebase Storage URLs) when ready.
 */
const seed: Omit<Product, 'images'>[] = [
  // ---------- Computers ----------
  {
    id: 'pc-001',
    name: 'ProBook 15 — Core i7 / 16GB / 512GB SSD',
    category: 'computers',
    brand: 'Alwaidh',
    price: 899,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80',
    rating: 4.6,
    inStock: true,
    shortDescription: 'Slim 15.6" business laptop with all-day battery and Wi-Fi 6.',
    description:
      'A reliable everyday productivity laptop for offices, students, and remote work. Includes fingerprint reader and backlit keyboard.',
    specs: {
      CPU: 'Intel Core i7-1255U',
      RAM: '16 GB DDR4',
      Storage: '512 GB NVMe SSD',
      Display: '15.6" FHD IPS',
      Battery: '57 Wh',
      OS: 'Windows 11 Pro',
    },
  },
  {
    id: 'pc-002',
    name: 'Creator Tower — Ryzen 9 / 32GB / RTX 4070',
    category: 'computers',
    brand: 'Alwaidh',
    price: 1899,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80',
    rating: 4.8,
    inStock: true,
    shortDescription: 'High-performance desktop for content creation and gaming.',
    description:
      'Built for creators: Ryzen 9 power, 32GB DDR5, NVMe Gen 4 storage, and an RTX 4070 GPU in a quiet, airflow-optimized chassis.',
    specs: {
      CPU: 'AMD Ryzen 9 7900',
      RAM: '32 GB DDR5',
      Storage: '1 TB NVMe Gen4',
      GPU: 'NVIDIA RTX 4070 12GB',
      PSU: '750 W 80+ Gold',
      OS: 'Windows 11 Pro',
    },
  },
  {
    id: 'pc-003',
    name: 'Office Mini PC — i5 / 16GB / 512GB',
    category: 'computers',
    brand: 'Alwaidh',
    price: 549,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=800&q=80',
    rating: 4.4,
    inStock: true,
    shortDescription: 'Compact, low-power mini PC perfect for offices and signage.',
    description:
      'A tidy mini PC with HDMI + DisplayPort dual output, gigabit Ethernet, and Wi-Fi 6. VESA mount included.',
    specs: {
      CPU: 'Intel Core i5-1335U',
      RAM: '16 GB DDR4',
      Storage: '512 GB NVMe',
      Ports: '2x HDMI, 1x DP, 4x USB, RJ45',
      OS: 'Windows 11 Pro',
    },
  },

  // ---------- Solar Energy ----------
  {
    id: 'solar-001',
    name: '450W Monocrystalline Solar Panel',
    category: 'solar',
    brand: 'SunMax',
    price: 159,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    rating: 4.7,
    inStock: true,
    shortDescription: 'High-efficiency 450W panel with 25-year performance warranty.',
    description:
      'Half-cut PERC monocrystalline modules with excellent low-light performance. Anodized aluminium frame and IP68 junction box.',
    specs: {
      Power: '450 W',
      Cells: 'Half-cut Mono PERC',
      Efficiency: '21.0%',
      Voc: '49.8 V',
      Weight: '23.5 kg',
      Warranty: '25 years performance',
    },
  },
  {
    id: 'solar-002',
    name: '5kW Hybrid Solar Inverter',
    category: 'solar',
    brand: 'VoltCore',
    price: 1099,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=800&q=80',
    rating: 4.5,
    inStock: true,
    shortDescription: 'On/off-grid hybrid inverter with battery support and Wi-Fi.',
    description:
      'Dual MPPT, pure sine-wave output, and integrated MPPT charge controller. Compatible with lithium and lead-acid banks.',
    specs: {
      Rating: '5 kW',
      MPPTs: '2',
      'PV Input': '500 V max',
      Battery: '48 V (Li/Lead)',
      Comms: 'Wi-Fi + RS485',
    },
  },
  {
    id: 'solar-003',
    name: '5.12kWh LiFePO4 Battery',
    category: 'solar',
    brand: 'VoltCore',
    price: 1499,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80',
    rating: 4.8,
    inStock: true,
    shortDescription: 'Wall-mount lithium iron phosphate battery with built-in BMS.',
    description:
      'Stackable 51.2V LiFePO4 module rated for 6000+ cycles. Communicates via CAN/RS485 with most hybrid inverters.',
    specs: {
      Capacity: '5.12 kWh',
      Voltage: '51.2 V',
      Cycles: '6000+ @ 80% DoD',
      Comms: 'CAN, RS485',
      Weight: '48 kg',
    },
  },

  // ---------- Tiandy Cameras ----------
  {
    id: 'cam-001',
    name: 'Tiandy 4MP IR Bullet Camera',
    category: 'tiandy-cameras',
    brand: 'Tiandy',
    price: 89,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80',
    rating: 4.5,
    inStock: true,
    shortDescription: 'Outdoor 4MP IP bullet camera with 30m IR night vision.',
    description:
      'Reliable outdoor surveillance camera with H.265+ encoding, IP67 rating, and PoE power. Compatible with Tiandy NVRs.',
    specs: {
      Resolution: '4 MP (2560x1440)',
      Lens: '2.8 mm',
      IR: '30 m',
      Codec: 'H.265+ / H.264',
      Rating: 'IP67',
      Power: 'PoE / 12V DC',
    },
  },
  {
    id: 'cam-002',
    name: 'Tiandy 8-Channel PoE NVR',
    category: 'tiandy-cameras',
    brand: 'Tiandy',
    price: 219,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1551808525-51a94da548ce?auto=format&fit=crop&w=800&q=80',
    rating: 4.6,
    inStock: true,
    shortDescription: '8-channel PoE NVR with HDMI/VGA output and 1 HDD bay.',
    description:
      'Plug-and-play 8-port PoE recorder supporting up to 8MP cameras. Free mobile app for remote viewing and playback.',
    specs: {
      Channels: '8 PoE',
      'Max Resolution': '8 MP per channel',
      Storage: '1 SATA HDD (up to 10 TB)',
      Outputs: 'HDMI 4K + VGA',
      Network: 'Gigabit',
    },
  },
  {
    id: 'cam-003',
    name: 'Tiandy 5MP PTZ Dome Camera',
    category: 'tiandy-cameras',
    brand: 'Tiandy',
    price: 459,
    currency: 'IQD',
    image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=800&q=80',
    rating: 4.7,
    inStock: false,
    shortDescription: '25x optical zoom outdoor PTZ camera with auto-tracking.',
    description:
      'Powerful PTZ dome with smart auto-tracking, 100m IR, and IP66 protection. Ideal for large outdoor areas.',
    specs: {
      Resolution: '5 MP',
      Zoom: '25x optical',
      IR: '100 m',
      Rating: 'IP66',
      Features: 'Auto-tracking, smart detection',
    },
  },
];

// Every seed product starts with a single-image gallery.
export const products: Product[] = seed.map((p) => ({ ...p, images: [p.image] }));

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.category === slug);
}
