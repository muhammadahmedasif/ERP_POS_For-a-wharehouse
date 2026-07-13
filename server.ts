import express from "express";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "crypto";
import nodemailer from "nodemailer";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing. Add it to your local .env and to Vercel Project Settings > Environment Variables.`);
  }
  return value;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  console.warn("WARNING: JWT_SECRET is missing! Using a temporary fallback secret. Please add a stable JWT_SECRET to your environment variables (or Vercel Project Settings) to avoid users being logged out unexpectedly when the server restarts.");
  return "development-only-jwt-secret-fallback-12345";
}

const JWT_SECRET = getJwtSecret();
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  return supabaseClient;
}

const supabase: any = new Proxy({}, {
  get(_target, prop) {
    const value = (getSupabase() as any)[prop];
    return typeof value === "function" ? value.bind(getSupabase()) : value;
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Nodemailer - lazy factory so env vars are always current (works in Vercel/serverless)
function getEmailTransporter() {
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  
  // Vercel/Cloud environments often block port 587. Default to 465 for Gmail to ensure delivery.
  const isGmail = smtpHost.includes('gmail.com');
  const defaultPort = isGmail ? '465' : '587';
  
  const smtpPort = parseInt(process.env.SMTP_PORT || defaultPort);
  // Force secure true for port 465, or if it's Gmail (since we default to 465)
  const useSecure = smtpPort === 465 || isGmail;

  return nodemailer.createTransport({
    host: smtpHost,
    port: isGmail ? 465 : smtpPort,
    secure: useSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    tls: {
      rejectUnauthorized: false, // Accept self-signed certs in dev; still encrypted
    },
  });
}



const CLOUDINARY_FOLDER = "w-distro-erp";
const CLOUDINARY_HOST_RE = /\/image\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:[?#].*)?$/;

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  };
}

function configureCloudinary() {
  const config = getCloudinaryConfig();
  if (!config) return false;
  cloudinary.config(config);
  return true;
}

function getCloudinaryPublicIdFromUrl(url?: string): string {
  if (!url || !url.includes("res.cloudinary.com")) return "";
  try {
    const decodedPath = decodeURIComponent(new URL(url).pathname);
    const match = decodedPath.match(CLOUDINARY_HOST_RE);
    return match?.[1] || "";
  } catch {
    const match = url.match(CLOUDINARY_HOST_RE);
    return match?.[1] || "";
  }
}

function isManagedCloudinaryAsset(publicId?: string): boolean {
  return !!publicId && publicId.startsWith(`${CLOUDINARY_FOLDER}/`);
}

function mapSettings(settings: any = {}) {
  return {
    billPrinter: settings.billPrinter || settings.bill_printer || 'Thermal Printer 80mm',
    storeName: settings.storeName || settings.store_name || 'My Wholesale Store',
    taxRate: Number(settings.taxRate ?? settings.tax_rate ?? 5),
    sellerName: settings.sellerName || settings.seller_name || '',
    profilePictureUrl: settings.profilePictureUrl || settings.profile_picture_url || '',
    profilePicturePublicId: settings.profilePicturePublicId
      || settings.profile_picture_public_id
      || getCloudinaryPublicIdFromUrl(settings.profilePictureUrl || settings.profile_picture_url),
    defaultLowInventoryThreshold: Number(settings.defaultLowInventoryThreshold ?? settings.default_low_inventory_threshold ?? 10),
  };
}

function mapSettingsToDb(settings: any = {}) {
  const mapped = mapSettings(settings);
  return {
    store_name: mapped.storeName,
    tax_rate: mapped.taxRate,
    seller_name: mapped.sellerName,
    profile_picture_url: mapped.profilePictureUrl,
    profile_picture_public_id: mapped.profilePicturePublicId,
    default_low_inventory_threshold: mapped.defaultLowInventoryThreshold,
  };
}

async function deleteCloudinaryImage(publicId?: string) {
  if (!isManagedCloudinaryAsset(publicId)) return;
  if (!configureCloudinary()) {
    console.error("Cloudinary delete skipped: CLOUDINARY_* values are missing.");
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Cloudinary delete failed for ${publicId}:`, error);
  }
}

function formatDatabaseError(error: any) {
  const causeCode = error?.cause?.code || error?.code;
  const causeMessage = error?.cause?.message || error?.message || "Unknown database error";
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || "missing";

  if (causeCode === "ENOTFOUND" || causeMessage.includes("ENOTFOUND")) {
    return `Supabase host cannot be resolved. Check SUPABASE_URL in .env and Vercel. Current host: ${supabaseUrl}`;
  }

  if (causeMessage.includes("fetch failed")) {
    return `Could not connect to Supabase. Check SUPABASE_URL in .env and Vercel. Current host: ${supabaseUrl}`;
  }

  return causeMessage;
}

function sendDatabaseError(res: express.Response, error: any, fallback = "Database request failed") {
  const message = formatDatabaseError(error);
  return res.status(500).json({ error: message || fallback });
}

function getRequestUserId(req: express.Request): string {
  const userId = (req as any).user?.userId;
  if (!userId) {
    throw new Error("Authenticated user is missing from request");
  }
  return userId;
}

function withOwner(req: express.Request, row: any = {}) {
  return { ...row, user_id: getRequestUserId(req) };
}

function ownerFilter(req: express.Request) {
  return { column: "user_id", value: getRequestUserId(req) };
}

function sendTenantSchemaError(res: express.Response, table: string, error: any) {
  if (error?.code === "42703" || error?.code === "PGRST204" || String(error?.message || "").includes("user_id")) {
    return res.status(500).json({
      error: `Profile isolation is enabled, but the '${table}' table is missing a user_id column. Add user_id to this table before using the app.`,
    });
  }
  return sendDatabaseError(res, error);
}

function mapProduct(p: any) {
  const skuMeta = parseProductSkuMeta(p.sku);
  const imageUrl = p.image_url || '';
  
  // Resolve brand if it's generic/empty, using name and barcode
  const rawBrand = p.brand_id || '';
  const resolvedBrand = typeof resolveBrand === 'function' ? resolveBrand(rawBrand, p.name || '', skuMeta.barcode || '') : rawBrand;

  return {
    id: p.id,
    name: p.name,
    sku: skuMeta.sku,
    barcode: skuMeta.barcode,
    lowInventoryThreshold: skuMeta.lowInventoryThreshold,
    unitType: skuMeta.unitType,
    purchasePrice: skuMeta.purchasePrice,
    stock: Number(p.stock) || 0,
    price: Number(p.price) || 0,
    imageUrl,
    publicId: getCloudinaryPublicIdFromUrl(imageUrl),
    category: p.category_id || '',
    brand: resolvedBrand,
    lastRestock: skuMeta.lastRestock,
    lastRestockAmount: skuMeta.lastRestockAmount,
    lastLowStockDate: skuMeta.lastLowStockDate,
    lastLowStockAmount: skuMeta.lastLowStockAmount
  };
}

function parseProductSkuMeta(rawSku: any) {
  const raw = String(rawSku || '');
  const parts = raw.split('::');
  if (parts.length === 1) {
    return {
      sku: raw,
      barcode: '',
      lowInventoryThreshold: undefined as number | undefined,
      unitType: '',
      purchasePrice: undefined as number | undefined,
    };
  }

  const [sku, barcode, lowThresholdStr, unitType, purchasePriceStr, lastRestock, lastRestockAmountStr, lastLowStockDate, lastLowStockAmountStr] = parts;
  const parsedLowThreshold = lowThresholdStr ? Number.parseInt(lowThresholdStr, 10) : undefined;
  const parsedPurchasePrice = purchasePriceStr ? Number.parseFloat(purchasePriceStr) : undefined;
  const parsedLastRestockAmount = lastRestockAmountStr ? Number.parseInt(lastRestockAmountStr, 10) : undefined;
  const parsedLastLowStockAmount = lastLowStockAmountStr ? Number.parseInt(lastLowStockAmountStr, 10) : undefined;

  return {
    sku: sku || raw,
    barcode: barcode || '',
    lowInventoryThreshold: Number.isFinite(parsedLowThreshold) ? parsedLowThreshold : undefined,
    unitType: unitType || '',
    purchasePrice: Number.isFinite(parsedPurchasePrice) ? parsedPurchasePrice : undefined,
    lastRestock: lastRestock || undefined,
    lastRestockAmount: Number.isFinite(parsedLastRestockAmount) ? parsedLastRestockAmount : undefined,
    lastLowStockDate: lastLowStockDate || undefined,
    lastLowStockAmount: Number.isFinite(parsedLastLowStockAmount) ? parsedLastLowStockAmount : undefined,
  };
}

function buildProductSkuMeta(
  sku: any,
  barcode?: any,
  lowInventoryThreshold?: any,
  unitType?: any,
  purchasePrice?: any,
  lastRestock?: any,
  lastRestockAmount?: any,
  lastLowStockDate?: any,
  lastLowStockAmount?: any,
) {
  return [
    String(sku || ''),
    String(barcode || ''),
    lowInventoryThreshold !== undefined && lowInventoryThreshold !== null ? String(lowInventoryThreshold) : '',
    String(unitType || ''),
    purchasePrice !== undefined && purchasePrice !== null && purchasePrice !== '' ? String(purchasePrice) : '',
    String(lastRestock || ''),
    lastRestockAmount !== undefined && lastRestockAmount !== null ? String(lastRestockAmount) : '',
    String(lastLowStockDate || ''),
    lastLowStockAmount !== undefined && lastLowStockAmount !== null ? String(lastLowStockAmount) : '',
  ].join('::');
}

function normalizeProductKey(value?: string) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeBrandKey(value?: string) {
  const normalized = normalizeProductKey(value);
  if (!normalized || normalized === 'unbranded' || normalized === 'unbranded / generic' || normalized === 'generic') {
    return 'unbranded / generic';
  }
  return normalized;
}

async function findDuplicateProduct(req: express.Request, name: any, category: any, brand: any, excludeId?: string) {
  const normalizedName = normalizeProductKey(capitalizeText(name));
  const normalizedCategory = normalizeProductKey(capitalizeText(category));
  const normalizedBrand = normalizeBrandKey(capitalizeText(brand));

  if (!normalizedName) {
    return null;
  }

  const { data, error } = await supabase
    .from('products')
    .select('id,name,category_id,brand_id,image_url')
    .eq('user_id', getRequestUserId(req));

  if (error) throw error;

  return (data || []).find((product: any) => {
    if (excludeId && product.id === excludeId) return false;
    return normalizeProductKey(product.name) === normalizedName
      && normalizeProductKey(product.category_id) === normalizedCategory
      && normalizeBrandKey(product.brand_id) === normalizedBrand;
  }) || null;
}

async function findProductByBarcode(req: express.Request, barcode: any, excludeId?: string) {
  const normalizedBarcode = normalizeProductKey(barcode);
  if (!normalizedBarcode) return null;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', getRequestUserId(req));

  if (error) throw error;

  return (data || []).find((product: any) => {
    if (excludeId && product.id === excludeId) return false;
    return normalizeProductKey(parseProductSkuMeta(product.sku).barcode) === normalizedBarcode;
  }) || null;
}

// ──────────────────────────────────────────────────────────────────
// COMPREHENSIVE BRAND RECOGNITION DATABASE
// Maps well-known product names to their actual brand/manufacturer
// ──────────────────────────────────────────────────────────────────
const PRODUCT_NAME_TO_BRAND: Record<string, string> = {
  // Beverages - Sodas & Soft Drinks
  '7up': 'PepsiCo', '7 up': 'PepsiCo', 'seven up': 'PepsiCo', 'pepsi': 'PepsiCo', 'mountain dew': 'PepsiCo',
  'mirinda': 'PepsiCo', 'slice': 'PepsiCo', 'sting': 'PepsiCo', 'aquafina': 'PepsiCo', 'tropicana': 'PepsiCo',
  'lays': 'PepsiCo', 'lay\'s': 'PepsiCo', 'doritos': 'PepsiCo', 'cheetos': 'PepsiCo', 'kurkure': 'PepsiCo',
  'coca cola': 'The Coca-Cola Company', 'coca-cola': 'The Coca-Cola Company', 'coke': 'The Coca-Cola Company',
  'sprite': 'The Coca-Cola Company', 'fanta': 'The Coca-Cola Company', 'minute maid': 'The Coca-Cola Company',
  'dasani': 'The Coca-Cola Company', 'powerade': 'The Coca-Cola Company', 'schweppes': 'The Coca-Cola Company',
  'red bull': 'Red Bull', 'redbull': 'Red Bull',
  'monster': 'Monster Energy', 'monster energy': 'Monster Energy',
  'gatorade': 'PepsiCo',
  // Water brands
  'nestle pure life': 'Nestlé', 'pure life': 'Nestlé', 'perrier': 'Nestlé', 'san pellegrino': 'Nestlé',
  'evian': 'Danone', 'volvic': 'Danone',
  // Nestlé products
  'nescafe': 'Nestlé', 'nescafé': 'Nestlé', 'maggi': 'Nestlé', 'kitkat': 'Nestlé', 'kit kat': 'Nestlé',
  'milo': 'Nestlé', 'nesquik': 'Nestlé', 'nido': 'Nestlé', 'cerelac': 'Nestlé', 'lactogen': 'Nestlé',
  'everyday': 'Nestlé', 'milkpak': 'Nestlé', 'milk pak': 'Nestlé', 'nestle': 'Nestlé',
  // Unilever products
  'lipton': 'Unilever', 'surf excel': 'Unilever', 'surf': 'Unilever', 'rin': 'Unilever',
  'dove': 'Unilever', 'lux': 'Unilever', 'sunsilk': 'Unilever', 'clear': 'Unilever',
  'pond\'s': 'Unilever', 'ponds': 'Unilever', 'vaseline': 'Unilever', 'fair & lovely': 'Unilever',
  'glow & lovely': 'Unilever', 'closeup': 'Unilever', 'close up': 'Unilever', 'signal': 'Unilever',
  'knorr': 'Unilever', 'hellmann\'s': 'Unilever', 'hellmanns': 'Unilever', 'axe': 'Unilever',
  'rexona': 'Unilever', 'brylcreem': 'Unilever', 'vim': 'Unilever', 'domex': 'Unilever',
  'lifebuoy': 'Unilever', 'comfort': 'Unilever', 'bru': 'Unilever', 'brooke bond': 'Unilever',
  'supreme': 'Unilever', 'supreme tea': 'Unilever',
  'tapal': 'Tapal', 'tapal danedar': 'Tapal', 'vital': 'Vital Tea',
  // P&G products
  'head & shoulders': 'Procter & Gamble', 'head and shoulders': 'Procter & Gamble', 'pantene': 'Procter & Gamble',
  'safeguard': 'Procter & Gamble', 'ariel': 'Procter & Gamble', 'tide': 'Procter & Gamble',
  'gillette': 'Procter & Gamble', 'oral-b': 'Procter & Gamble', 'oral b': 'Procter & Gamble',
  'pampers': 'Procter & Gamble', 'always': 'Procter & Gamble', 'bounty': 'Procter & Gamble',
  'downy': 'Procter & Gamble', 'olay': 'Procter & Gamble', 'old spice': 'Procter & Gamble',
  'vicks': 'Procter & Gamble', 'herbal essences': 'Procter & Gamble',
  // Colgate-Palmolive
  'colgate': 'Colgate-Palmolive', 'palmolive': 'Colgate-Palmolive',
  // Johnson & Johnson
  'johnson': 'Johnson & Johnson', 'johnson\'s': 'Johnson & Johnson', 'johnsons': 'Johnson & Johnson',
  'band-aid': 'Johnson & Johnson', 'listerine': 'Johnson & Johnson', 'neutrogena': 'Johnson & Johnson',
  'aveeno': 'Johnson & Johnson', 'clean & clear': 'Johnson & Johnson',
  // Reckitt
  'dettol': 'Reckitt', 'harpic': 'Reckitt', 'mortein': 'Reckitt', 'veet': 'Reckitt',
  'finish': 'Reckitt', 'air wick': 'Reckitt', 'durex': 'Reckitt', 'strepsils': 'Reckitt',
  'nurofen': 'Reckitt', 'gaviscon': 'Reckitt',
  // Henkel
  'persil': 'Henkel', 'schwarzkopf': 'Henkel',
  // L'Oréal
  'loreal': 'L\'Oréal', 'l\'oreal': 'L\'Oréal', 'garnier': 'L\'Oréal', 'maybelline': 'L\'Oréal',
  'nyx': 'L\'Oréal', 'lancome': 'L\'Oréal', 'kerastase': 'L\'Oréal',
  // Beiersdorf
  'nivea': 'Beiersdorf', 'eucerin': 'Beiersdorf',
  // Mars / Snacks
  'snickers': 'Mars', 'twix': 'Mars', 'm&m': 'Mars', 'bounty bar': 'Mars', 'milky way': 'Mars',
  'skittles': 'Mars', 'pedigree': 'Mars', 'whiskas': 'Mars', 'uncle ben': 'Mars',
  // Mondelez
  'oreo': 'Mondelez', 'cadbury': 'Mondelez', 'dairy milk': 'Mondelez', 'tang': 'Mondelez',
  'toblerone': 'Mondelez', 'ritz': 'Mondelez', 'lu': 'Mondelez', 'prince': 'Mondelez',
  'halls': 'Mondelez', 'trident': 'Mondelez', 'chips ahoy': 'Mondelez',
  // Ferrero
  'nutella': 'Ferrero', 'ferrero rocher': 'Ferrero', 'kinder': 'Ferrero', 'tic tac': 'Ferrero',
  // Kellogg's
  'kellogg': 'Kellogg\'s', 'kelloggs': 'Kellogg\'s', 'corn flakes': 'Kellogg\'s', 'froot loops': 'Kellogg\'s',
  'pringles': 'Kellogg\'s', 'special k': 'Kellogg\'s',
  // Pakistani / Local brands
  'shan': 'Shan Foods', 'national': 'National Foods', 'mehran': 'Mehran Foods',
  'dalda': 'Dalda', 'habib': 'Habib Oil Mills', 'sufi': 'Sufi Group',
  'olpers': 'Engro Foods', 'omore': 'Engro Foods', 'tarang': 'Engro Foods',
  'nurpur': 'Fauji Foods', 'fauji': 'Fauji Foods',
  'peek freans': 'EBM', 'sooper': 'EBM', 'rio': 'EBM', 'gluco': 'EBM',
  'kolson': 'Kolson', 'shezan': 'Shezan',
  'mitchells': 'Mitchell\'s', 'mitchell': 'Mitchell\'s',
  'rooh afza': 'Hamdard', 'hamdard': 'Hamdard',
  'rafhan': 'Unilever', 'energile': 'Unilever',
  'molty foam': 'Master MoltyFoam', 'diamond supreme': 'Diamond Supreme',
  // Samsung / Electronics
  'samsung': 'Samsung', 'galaxy': 'Samsung',
  'apple': 'Apple', 'iphone': 'Apple', 'ipad': 'Apple', 'macbook': 'Apple', 'airpods': 'Apple',
  'huawei': 'Huawei', 'oppo': 'OPPO', 'vivo': 'Vivo', 'xiaomi': 'Xiaomi', 'redmi': 'Xiaomi',
  'realme': 'Realme', 'nokia': 'Nokia', 'sony': 'Sony', 'lg': 'LG', 'philips': 'Philips',
  'panasonic': 'Panasonic', 'toshiba': 'Toshiba', 'hp': 'HP', 'dell': 'Dell', 'lenovo': 'Lenovo',
  'asus': 'ASUS', 'acer': 'Acer', 'jbl': 'JBL', 'bose': 'Bose', 'beats': 'Beats',
  'anker': 'Anker', 'baseus': 'Baseus', 'ugreen': 'UGREEN',
  // Health / Pharma
  'panadol': 'GSK', 'disprin': 'Reckitt', 'calpol': 'GSK', 'augmentin': 'GSK',
  'sensodyne': 'GSK', 'voltaren': 'GSK', 'centrum': 'GSK', 'eno': 'GSK',
  'ibuprofen': 'Various', 'paracetamol': 'Various',
};

// GS1 barcode prefix → brand/company mapping for intelligent barcode recognition
const GS1_PREFIX_TO_BRAND: [string, string][] = [
  // Pakistan (896)
  ['8964', 'Various (Pakistan)'],
  // India (890)
  ['8901030', 'Hindustan Unilever'], ['89010', 'Various (India)'],
  // USA (001-019)
  ['0012000', 'PepsiCo'], ['0049000', 'The Coca-Cola Company'], ['001200080', 'PepsiCo'],
  ['004900000', 'Coca-Cola'], ['0028400', 'Frito-Lay (PepsiCo)'],
  // Europe
  ['871', 'Various (Netherlands)'], ['400', 'Various (Germany)'], ['300', 'Various (France)'],
  // China (690-699)
  ['690', 'Various (China)'], ['691', 'Various (China)'], ['692', 'Various (China)'],
  // Japan (450-459, 490-499)
  ['450', 'Various (Japan)'], ['490', 'Various (Japan)'],
  // UK (500-509)
  ['500', 'Various (UK)'], ['501', 'Various (UK)'],
  // Turkey (869)
  ['869', 'Various (Turkey)'],
  // UAE (629)
  ['629', 'Various (UAE)'],
  // Saudi Arabia (628)
  ['628', 'Various (Saudi Arabia)'],
];

// ──────────────────────────────────────────────────────────────────
// INTELLIGENT BRAND RESOLUTION
// ──────────────────────────────────────────────────────────────────
function identifyBrandFromName(productName: string): string | null {
  const lowerName = normalizeProductKey(productName);
  if (!lowerName) return null;

  // Direct lookup
  if (PRODUCT_NAME_TO_BRAND[lowerName]) return PRODUCT_NAME_TO_BRAND[lowerName];

  // Check if any known product name is contained within the full name
  for (const [key, brand] of Object.entries(PRODUCT_NAME_TO_BRAND)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return brand;
    }
  }

  // Word-level matching: check if the first word or any significant word matches
  const words = lowerName.split(/\s+/);
  for (const word of words) {
    if (word.length < 2) continue;
    if (PRODUCT_NAME_TO_BRAND[word]) return PRODUCT_NAME_TO_BRAND[word];
  }

  return null;
}

function identifyBrandFromBarcode(barcode: string): string | null {
  if (!barcode || barcode.length < 4) return null;

  // Try longest prefix first for more specific matches
  for (let len = Math.min(barcode.length, 10); len >= 3; len--) {
    const prefix = barcode.substring(0, len);
    const match = GS1_PREFIX_TO_BRAND.find(([p]) => p === prefix);
    if (match && !match[1].startsWith('Various')) return match[1];
  }
  return null;
}

function resolveBrand(rawBrand: string, productName: string, barcode: string): string {
  // If brand is already meaningful, capitalize and return
  const normalized = normalizeBrandKey(rawBrand);
  if (normalized !== 'unbranded / generic' && rawBrand && rawBrand.trim()) {
    return capitalizeText(rawBrand.trim());
  }

  // Try identifying from product name first (most accurate)
  const brandFromName = identifyBrandFromName(productName);
  if (brandFromName) return brandFromName;

  // Try identifying from barcode prefix
  const brandFromBarcode = identifyBrandFromBarcode(barcode);
  if (brandFromBarcode) return brandFromBarcode;

  return 'Unbranded / Generic';
}

// ──────────────────────────────────────────────────────────────────
// EXPANDED CATEGORY CLASSIFICATION
// ──────────────────────────────────────────────────────────────────
function classifyProductType(input: any) {
  const text = normalizeProductKey(input);
  // Food & Grocery
  if (/\b(rice|daal|dal|lentil|wheat|flour|atta|sugar|salt|oil|ghee|masala|spice|spices|noodle|noodles|biscuit|biscuits|cookie|cookies|bread|milk|tea|coffee|cereal|snack|snacks|chocolate|ketchup|sauce|pasta|spaghetti|macaroni|vermicelli|jam|jelly|honey|butter|cheese|yogurt|yoghurt|cream cheese|mayo|mayonnaise|vinegar|pickle|chutney|chips|crisps|popcorn|nuts|peanut|almond|cashew|raisin|dates|dried fruit|canned|beans|chickpea|soup|broth|oats|oatmeal|muesli|granola|pancake|waffle|syrup|condensed milk|evaporated milk|powdered milk|candy|toffee|gum|chewing gum|marshmallow|pudding|custard|dessert|cake mix|baking|yeast|cornstarch|gelatin|food color|essence|extract|soy sauce|fish sauce|oyster sauce|hot sauce|bbq sauce|tomato paste|tomato puree|coconut milk|coconut cream|cooking oil|olive oil|canola oil|sunflower oil|corn oil|sesame oil)\b/.test(text)) {
    return 'food';
  }
  // Beverages
  if (/\b(juice|cola|soda|water|drink|drinks|beverage|beverages|energy drink|soft drink|mineral water|sparkling|tonic|lemonade|iced tea|smoothie|milkshake|squash|cordial|syrup drink|carbonated|non-carbonated|flavored water|coconut water|aloe vera drink|kombucha|malt|beer|wine|spirit|whisky|vodka|rum|gin|brandy|champagne|mocktail)\b/.test(text)) {
    return 'beverages';
  }
  // Cosmetics & Beauty
  if (/\b(soap|shampoo|cream|lotion|makeup|lipstick|perfume|deodorant|toothpaste|face wash|cosmetic|cosmetics|beauty|skincare|skin care|sunscreen|sunblock|spf|moisturizer|moisturiser|serum|toner|cleanser|exfoliator|scrub|mask|face mask|sheet mask|eye cream|anti-aging|anti aging|wrinkle|acne|pimple|blemish|foundation|concealer|primer|setting spray|powder|blush|bronzer|highlighter|contour|eyeshadow|eye shadow|eyeliner|eye liner|mascara|brow|eyebrow|lip gloss|lip balm|lip liner|nail polish|nail paint|nail remover|hair gel|hair wax|hair spray|hair oil|hair color|hair dye|hair mask|conditioner|body wash|body lotion|body butter|body spray|body mist|hand cream|hand wash|hand sanitizer|cologne|eau de toilette|aftershave|razor|shaving|beard|mustache|wax strip|depilatory|bleach cream|facial|bb cream|cc cream|micellar|makeup remover|cotton pad|cotton ball|cotton bud|q-tip|tweezer|eyelash|false lashes|beauty blender|sponge|brush set|comb|hair brush|hair dryer|straightener|curler|trimmer|clipper|epilator)\b/.test(text)) {
    return 'cosmetics';
  }
  // Electronics
  if (/\b(charger|mobile|phone|cable|adapter|battery|batteries|earphone|earphones|headphone|headphones|usb|led|bulb|electronics?|laptop|tablet|computer|pc|monitor|screen|keyboard|mouse|speaker|speakers|bluetooth|wifi|router|modem|power bank|powerbank|smart watch|smartwatch|fitness band|camera|webcam|microphone|mic|projector|printer|scanner|hard drive|ssd|flash drive|pen drive|memory card|sd card|sim card|remote|controller|gamepad|console|gaming|smart home|alexa|google home|ring|doorbell|cctv|security camera|drone|robot|gps|tracker|converter|inverter|stabilizer|ups|extension cord|power strip|surge protector|socket|switch|plug|dimmer|fan|heater|air conditioner|ac|cooler|refrigerator|fridge|microwave|oven|blender|mixer|grinder|juicer|toaster|kettle|iron|vacuum|washing machine|dryer|dishwasher|water purifier|air purifier|humidifier|dehumidifier)\b/.test(text)) {
    return 'electronics';
  }
  // Household & Cleaning
  if (/\b(detergent|cleaner|dishwash|dishwashing|tissue|tissues|napkin|napkins|foil|aluminium foil|aluminum foil|cling wrap|plastic wrap|garbage bag|trash bag|bin liner|brush|mop|broom|bucket|dustpan|sponge|scrubber|steel wool|household|phenyl|bleach|disinfectant|sanitizer|air freshener|room spray|candle|incense|mothball|pest control|insecticide|mosquito|cockroach|ant killer|rat poison|fly paper|gloves|rubber gloves|laundry|fabric softener|starch|stain remover|toilet cleaner|bathroom cleaner|glass cleaner|floor cleaner|kitchen cleaner|multi-purpose|all purpose|polish|wax|drain cleaner|plunger|lint roller|duster|cloth|rag|paper towel|kitchen roll|toilet paper|toilet roll|facial tissue|wet wipes|wipes|match|matchbox|lighter|candle)\b/.test(text)) {
    return 'household';
  }
  // Health & Pharmacy
  if (/\b(vitamin|vitamins|supplement|supplements|medicine|medication|tablet|capsule|syrup|ointment|balm|bandage|band-aid|plaster|thermometer|sanitizer|antiseptic|antibiotic|painkiller|pain relief|cough|cold|flu|fever|allergy|antacid|laxative|probiotic|protein powder|whey|creatine|omega|fish oil|calcium|iron|zinc|magnesium|multivitamin|herbal|ayurvedic|homeopathic|first aid|medical|health|wellness|pharmacy|pharmaceutical|prescription|otc|over the counter|inhaler|nebulizer|blood pressure|glucose|diabetes|insulin|test strip|pregnancy test|condom|contraceptive|sanitary pad|sanitary napkin|tampon|menstrual|panty liner|diaper|adult diaper|hearing aid|wheelchair|crutch|brace|support|orthopedic|eye drop|ear drop|nasal spray|throat lozenge|dental|denture|mouthwash|floss|dental floss|toothbrush|electric toothbrush)\b/.test(text)) {
    return 'health';
  }
  // Stationery & Office
  if (/\b(pen|pencil|notebook|eraser|ruler|marker|markers|highlighter|crayon|sketch|drawing|paint|paintbrush|canvas|glue|adhesive|tape|scotch tape|masking tape|scissors|stapler|staples|paper clip|binder|folder|file|envelope|paper|a4|a3|copy paper|printing paper|ink|cartridge|toner|whiteboard|blackboard|chalk|permanent marker|dry erase|sticky note|post-it|index card|calendar|planner|diary|journal|calculator|geometry box|compass|protractor|sharpener|correction fluid|correction tape|white out|rubber band|push pin|thumbtack|bulletin board|desk organizer|pen holder|bookend|laminator|laminating|stationery|school supplies|office supplies)\b/.test(text)) {
    return 'stationery';
  }
  // Baby & Kids
  if (/\b(baby|infant|toddler|newborn|diaper|diapers|nappy|nappies|baby food|formula|baby formula|baby milk|baby cereal|baby wipes|baby lotion|baby oil|baby powder|baby shampoo|baby soap|baby wash|pacifier|teether|bottle|feeding bottle|sippy cup|bib|baby blanket|swaddle|onesie|romper|baby clothes|stroller|pram|car seat|baby carrier|crib|bassinet|playpen|baby monitor|rattle|toy|toys|stuffed animal|plush|building blocks|puzzle|coloring book|lego)\b/.test(text)) {
    return 'baby';
  }
  // Pet Products
  if (/\b(dog food|cat food|pet food|pet treat|dog treat|cat treat|pet toy|dog toy|cat toy|pet bed|dog bed|cat bed|leash|collar|pet collar|harness|pet shampoo|flea|tick|pet medicine|litter|cat litter|aquarium|fish food|bird food|bird seed|pet cage|hamster|rabbit|guinea pig|pet grooming|pet brush|pet bowl|dog bowl|cat bowl|kennel|dog house|pet carrier)\b/.test(text)) {
    return 'pet';
  }
  // Automotive
  if (/\b(engine oil|motor oil|brake fluid|coolant|antifreeze|car wash|car wax|car polish|tire|tyre|wiper|wiper blade|air filter|oil filter|spark plug|car battery|jump cable|car charger|car mount|phone mount|dash cam|car freshener|car perfume|steering|seat cover|floor mat|car cover|fuel additive|lubricant|grease|automotive)\b/.test(text)) {
    return 'automotive';
  }
  // Sports & Fitness
  if (/\b(sports|sport|fitness|gym|exercise|workout|yoga|mat|dumbbell|weight|barbell|resistance band|jump rope|skipping rope|treadmill|bicycle|cycle|cricket|bat|ball|football|soccer|basketball|tennis|badminton|racket|shuttlecock|gloves|boxing|swimming|goggles|cap|helmet|knee pad|elbow pad|shin guard|jersey|tracksuit|running shoes|sneakers|cleats|water bottle|shaker|gym bag|sports bag)\b/.test(text)) {
    return 'sports';
  }
  return 'unknown';
}

function displayCategoryFromType(productType: string, fallback?: string) {
  if (fallback && fallback.trim()) return capitalizeText(fallback.replace(/^en:/, '').replace(/-/g, ' '));
  switch (productType) {
    case 'food':
      return 'Food & Grocery';
    case 'beverages':
      return 'Beverages';
    case 'cosmetics':
      return 'Cosmetics & Beauty';
    case 'electronics':
      return 'Electronics';
    case 'household':
      return 'Household & Cleaning';
    case 'health':
      return 'Health & Pharmacy';
    case 'stationery':
      return 'Stationery & Office';
    case 'baby':
      return 'Baby & Kids';
    case 'pet':
      return 'Pet Products';
    case 'automotive':
      return 'Automotive';
    case 'sports':
      return 'Sports & Fitness';
    default:
      return 'Other / Custom';
  }
}

function mapLocalProductSuggestion(product: any) {
  const mapped = mapProduct(product);
  const productType = classifyProductType(`${mapped.category} ${mapped.name} ${mapped.brand || ''}`);
  // Resolve brand if it's generic
  const resolvedBrand = resolveBrand(mapped.brand || '', mapped.name, mapped.barcode || '');
  return {
    ...mapped,
    brand: resolvedBrand,
    source: 'supabase',
    productType,
    locked: true,
  };
}

function sourceFromProductType(productType: string) {
  if (productType === 'beauty') return 'open_beauty_facts';
  if (productType === 'product') return 'open_products_facts';
  return 'open_food_facts';
}

function mapOpenFactsProduct(product: any, fallbackBarcode = '', sourceHint = 'open_food_facts') {
  let name = product?.product_name_en || product?.product_name || product?.generic_name_en || product?.generic_name || '';
  if (!name) return null;

  // Append quantity/weight to name if available and not already present (e.g. "200 g", "1 kg", "500 ml")
  const quantity = String(product?.quantity || '').trim();
  if (quantity && !name.toLowerCase().includes(quantity.toLowerCase())) {
    // Check if the weight/size info is already embedded in the name
    const qNorm = quantity.replace(/\s+/g, '').toLowerCase();
    const nameNorm = name.replace(/\s+/g, '').toLowerCase();
    if (!nameNorm.includes(qNorm)) {
      name = `${name} ${quantity}`;
    }
  }

  const barcode = String(product?.code || fallbackBarcode || '');
  const rawBrand = String(product?.brands || '').split(',')[0]?.trim() || '';
  const brand = resolveBrand(rawBrand, name, barcode);
  const categoryText = String(product?.categories || product?.categories_tags?.[0] || '');
  const externalProductType = String(product?.product_type || '').toLowerCase();
  const typeInput = `${name} ${brand} ${categoryText} ${externalProductType}`;
  const productType = classifyProductType(typeInput);

  return {
    source: externalProductType ? sourceFromProductType(externalProductType) : sourceHint,
    barcode,
    name,
    brand,
    category: displayCategoryFromType(productType, categoryText),
    imageUrl: product?.image_front_url || product?.image_url || product?.selected_images?.front?.display?.en || '',
    productType,
    locked: true,
  };
}

// ──────────────────────────────────────────────────────────────────
// MULTI-SOURCE BARCODE LOOKUP
// ──────────────────────────────────────────────────────────────────

// ── TTL cache ────────────────────────────────────────────────────
// Prevents hammering the same 10 external APIs for every re-scan.
interface CacheEntry<T> { value: T; expiresAt: number; }
class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  constructor(private readonly ttlMs: number) {}
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return undefined; }
    return entry.value;
  }
  set(key: string, value: T) {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    // Evict stale entries when cache grows large
    if (this.store.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.store) { if (now > v.expiresAt) this.store.delete(k); }
    }
  }
}
const barcodeResultCache = new TtlCache<any>(30 * 60 * 1000);  // 30 min
const searchResultCache  = new TtlCache<any[]>(10 * 60 * 1000); // 10 min

// ── In-flight de-duplication ──────────────────────────────────────
// If two simultaneous requests arrive for the same barcode, the second
// awaits the first instead of launching a duplicate fan-out.
const inflightBarcode = new Map<string, Promise<any>>();


const OFF_BARCODE_FIELDS = [
  'code', 'product_name', 'product_name_en', 'generic_name', 'generic_name_en',
  'brands', 'categories', 'categories_tags', 'image_url', 'image_front_url',
  'selected_images', 'product_type', 'quantity',
].join(',');

const OFF_USER_AGENT = `StockPilotWholesaleERP/1.0 (product lookup; contact: ${process.env.SMTP_USER || 'local-app'})`;
const WEB_SEARCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchFromOpenFactsAPI(baseUrl: string, barcode: string, sourceHint: string) {
  try {
    const url = `${baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?product_type=all&fields=${encodeURIComponent(OFF_BARCODE_FIELDS)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // tightened: 4 s
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': OFF_USER_AGENT },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.status !== 1 || !data?.product) return null;
    return mapOpenFactsProduct(data.product, barcode, sourceHint);
  } catch {
    return null;
  }
}

async function fetchUpcItemDbProduct(barcode: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // tightened: 4 s
    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': OFF_USER_AGENT },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.items?.length) return null;
    const item = data.items[0];
    const name = item.title || '';
    if (!name) return null;
    const rawBrand = item.brand || '';
    const brand = resolveBrand(rawBrand, name, barcode);
    const categoryText = item.category || '';
    const productType = classifyProductType(`${name} ${brand} ${categoryText}`);
    return {
      source: 'open_products_facts' as const,
      barcode,
      name,
      brand,
      category: displayCategoryFromType(productType, categoryText),
      imageUrl: (item.images || [])[0] || '',
      productType,
      locked: true,
    };
  } catch {
    return null;
  }
}

function decodeSearchText(value: any) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSearchProductName(title: string, barcode: string) {
  return decodeSearchText(title)
    .replace(new RegExp(barcode, 'g'), '')
    .replace(/\b(upc|ean|barcode|gtin)\b/gi, '')
    .replace(/\s*[-|:]\s*(amazon|ebay|walmart|barcode lookup|upc lookup|ean lookup|isbn search|upc database|open food facts|open products facts).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

function mapSearchResultProduct(barcode: string, rawTitle: string, rawSnippet = '') {
  const title = decodeSearchText(rawTitle);
  const snippet = decodeSearchText(rawSnippet);
  const text = `${title} ${snippet}`.trim();
  if (!text || text.length < 5) return null;

  const junkPatterns = /barcode\s*(lookup|scanner|search|finder|generator|reader)|upc\s*(database|lookup|search)|ean\s*(lookup|search)|gtin\s*(lookup|search)|find\s*barcode/i;
  const directoryTitlePatterns = /\b(lookup|search|database|finder|scanner|isbn)\b/i;
  const nonProductPatterns = /\b(google translate|translate|translator|dictionary|youtube|facebook|instagram|linkedin|login|sign in|map|maps|image search|news|pdf|manual|wikipedia)\b/i;
  const productSignalPatterns = /\b(product|price|buy|shop|store|pack|packet|case|carton|box|bottle|can|jar|tin|pouch|sachet|bar|tube|ml|cl|l|liter|litre|g|gm|gram|kg|pcs|piece|pieces)\b/i;
  const productType = classifyProductType(text);
  const titleLooksProductLike = productSignalPatterns.test(title) || classifyProductType(title) !== 'unknown';
  const brandHint = identifyBrandFromBarcode(barcode) || (titleLooksProductLike || text.includes(barcode) ? identifyBrandFromName(title) : '') || '';

  if (nonProductPatterns.test(text)) return null;
  if (directoryTitlePatterns.test(title) && !identifyBrandFromName(title) && classifyProductType(title) === 'unknown') return null;
  if (junkPatterns.test(text) && !brandHint) return null;
  if (!text.includes(barcode) && !brandHint) return null;
  if (!brandHint && productType === 'unknown' && !productSignalPatterns.test(text)) return null;

  let cleanName = cleanSearchProductName(title, barcode) || cleanSearchProductName(text, barcode);
  if (!cleanName || cleanName.length < 3) return null;
  if (directoryTitlePatterns.test(cleanName) && !identifyBrandFromName(cleanName) && classifyProductType(cleanName) === 'unknown') return null;
  if (junkPatterns.test(cleanName) && !brandHint) return null;

  const brand = resolveBrand(brandHint, cleanName, barcode);

  return {
    source: 'web_search' as const,
    barcode,
    name: cleanName,
    brand,
    category: displayCategoryFromType(productType),
    imageUrl: '',
    productType,
    locked: false,
  };
}

async function fetchSearchHtml(url: string, timeoutMs = 5000) {
  const doFetch = async (targetUrl: string, ms = timeoutMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': WEB_SEARCH_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
        }
      });
      clearTimeout(timeout);
      if (!response.ok) return '';
      return await response.text();
    } catch {
      clearTimeout(timeout);
      return '';
    }
  };

  try {
    const html = await doFetch(url);
    if (!html || html.includes('captcha') || html.includes('cloudflare')) {
      // Bypass datacenter IP blocks using proxy — give it a shorter window
      return await doFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, 3000);
    }
    return html;
  } catch {
    return await doFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, 3000);
  }
}

async function fetchDuckDuckGoBarcode(barcode: string) {
  const html = await fetchSearchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(barcode + ' product')}`);
  if (!html) return null;

  const titleRegex = /class="result__title[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = titleRegex.exec(html))) {
    const nextChunk = html.slice(titleRegex.lastIndex, titleRegex.lastIndex + 1600);
    const snippetMatch = nextChunk.match(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      || nextChunk.match(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const mapped = mapSearchResultProduct(barcode, match[1], snippetMatch?.[1] || '');
    if (mapped) return mapped;
  }

  return null;
}

async function fetchBingBarcode(barcode: string) {
  const html = await fetchSearchHtml(`https://www.bing.com/search?q=${encodeURIComponent(barcode + ' product')}`);
  if (!html) return null;

  const resultRegex = /<li[^>]+class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  let match: RegExpExecArray | null;
  while ((match = resultRegex.exec(html))) {
    const mapped = mapSearchResultProduct(barcode, match[1], match[2] || '');
    if (mapped) return mapped;
  }

  return null;
}

async function fetchGoUpcBarcode(barcode: string) {
  const html = await fetchSearchHtml(`https://go-upc.com/search?q=${barcode}`);
  if (!html) return null;

  const nameMatch = html.match(/<h1[^>]*class="[^"]*product-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (!nameMatch) return null;

  const name = nameMatch[1].trim();
  const brandMatch = html.match(/<td>Brand<\/td>\s*<td>([^<]+)<\/td>/i);
  const brand = brandMatch ? brandMatch[1].trim() : resolveBrand('', name, barcode);
  
  const categoryMatch = html.match(/<td>Category<\/td>\s*<td>([^<]+)<\/td>/i);
  const categoryText = categoryMatch ? categoryMatch[1].trim() : '';
  
  const imgMatch = html.match(/<figure[^>]*class="[^"]*product-image[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i);
  let imageUrl = imgMatch ? imgMatch[1] : '';
  if (imageUrl.startsWith('/')) imageUrl = `https://go-upc.com${imageUrl}`;

  const productType = classifyProductType(`${name} ${brand} ${categoryText}`);

  return {
    source: 'web_search' as const,
    barcode,
    name,
    brand,
    category: displayCategoryFromType(productType, categoryText),
    imageUrl,
    productType,
    locked: true,
  };
}

async function fetchGroqBarcodePrediction(barcode: string) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // tightened: 5 s
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{
          role: "system",
          content: "You are a product identification API. User provides a barcode. If you know or can confidently guess the product for this standard UPC/EAN, reply ONLY with a valid JSON object in this format: {\\\"name\\\": \\\"Product Name\\\", \\\"brand\\\": \\\"Brand Name\\\", \\\"category\\\": \\\"Category\\\"}. If you do not know it, reply with exactly: {\\\"error\\\": \\\"unknown\\\"}. Do not include markdown formatting or any other text."
        }, {
          role: "user",
          content: barcode
        }],
        temperature: 0.1,
        max_tokens: 150
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    if (parsed.error || !parsed.name || parsed.name.toLowerCase().includes('unknown')) return null;

    const brand = resolveBrand(parsed.brand || '', parsed.name, barcode);
    const productType = classifyProductType(`${parsed.name} ${parsed.brand} ${parsed.category}`);
    
    return {
      source: 'web_search' as const,
      barcode,
      name: parsed.name,
      brand,
      category: displayCategoryFromType(productType, parsed.category),
      imageUrl: '',
      productType,
      locked: false,
    };
  } catch {
    return null;
  }
}

async function fetchGeminiBarcodePrediction(barcode: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // tightened: 5 s
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a product identification API. Barcode: ${barcode}. If you confidently know this standard UPC/EAN, reply ONLY with a valid JSON: {"name": "Product Name", "brand": "Brand Name", "category": "Category"}. If unknown, reply: {"error": "unknown"}.`
          }]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    if (parsed.error || !parsed.name || parsed.name.toLowerCase().includes('unknown')) return null;

    const brand = resolveBrand(parsed.brand || '', parsed.name, barcode);
    const productType = classifyProductType(`${parsed.name} ${parsed.brand} ${parsed.category}`);
    
    return {
      source: 'web_search' as const,
      barcode,
      name: parsed.name,
      brand,
      category: displayCategoryFromType(productType, parsed.category),
      imageUrl: '',
      productType,
      locked: false,
    };
  } catch {
    return null;
  }
}

async function comprehensiveBarcodeLookup(barcode: string): Promise<any> {
  // ── Phase 1: fast/reliable sources in parallel (4 s max) ─────────────────
  // These typically resolve in < 2 s and cover the vast majority of barcodes.
  const phase1 = await Promise.allSettled([
    fetchFromOpenFactsAPI('https://world.openfoodfacts.org',  barcode, 'open_food_facts'),
    fetchFromOpenFactsAPI('https://world.openbeautyfacts.org', barcode, 'open_beauty_facts'),
    fetchFromOpenFactsAPI('https://world.openproductsfacts.org', barcode, 'open_products_facts'),
    fetchFromOpenFactsAPI('https://world.openpetfoodfacts.org', barcode, 'open_food_facts'),
    fetchUpcItemDbProduct(barcode),
    fetchGoUpcBarcode(barcode),
    fetchGroqBarcodePrediction(barcode),
    fetchGeminiBarcodePrediction(barcode),
  ]);

  for (const result of phase1) {
    if (result.status === 'fulfilled' && result.value) return result.value;
  }

  // ── Phase 2: slow/scrape-based sources (only if phase 1 has nothing) ─────
  // Bing and DuckDuckGo are brittle HTML scrapers — use only as last resort.
  const phase2 = await Promise.allSettled([
    fetchBingBarcode(barcode),
    fetchDuckDuckGoBarcode(barcode),
  ]);

  for (const result of phase2) {
    if (result.status === 'fulfilled' && result.value) return result.value;
  }

  // ── Last resort: minimal entry from barcode-prefix brand intelligence ─────
  const brandFromBarcode = identifyBrandFromBarcode(barcode);
  if (brandFromBarcode) {
    return {
      source: 'open_products_facts' as const,
      barcode,
      name: '',
      brand: brandFromBarcode,
      category: 'Other / Custom',
      imageUrl: '',
      productType: 'unknown',
      locked: false,
    };
  }

  return null;
}

// Keep backward-compatible function name
async function fetchOpenFoodFactsProductByBarcode(barcode: string) {
  return comprehensiveBarcodeLookup(barcode);
}

async function searchOpenFoodFacts(query: string) {
  const sources = [
    { baseUrl: 'https://world.openfoodfacts.org', source: 'open_food_facts' },
    { baseUrl: 'https://world.openbeautyfacts.org', source: 'open_beauty_facts' },
    { baseUrl: 'https://world.openproductsfacts.org', source: 'open_products_facts' },
  ];

  const searchFields = 'code,product_name,product_name_en,generic_name,generic_name_en,brands,categories,categories_tags,image_url,image_front_url,selected_images,product_type,quantity';

  const results = await Promise.all(sources.map(async ({ baseUrl, source }) => {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '4',    // reduced from 6 — fewer results, faster response
      fields: searchFields,
    });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // tightened: 4 s
      const response = await fetch(`${baseUrl}/cgi/search.pl?${params.toString()}`, {
        signal: controller.signal,
        headers: { 'User-Agent': OFF_USER_AGENT },
      });
      clearTimeout(timeout);
      if (!response.ok) return [];
      const data = await response.json();
      return (data?.products || [])
        .map((product: any) => mapOpenFactsProduct(product, '', source))
        .filter(Boolean);
    } catch {
      return [];
    }
  }));

  const seen = new Set<string>();
  return results.flat().filter((product: any) => {
    const key = normalizeProductKey(product.barcode || `${product.name} ${product.brand} ${product.category}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function extractFirstNumber(text: string, fallback = 0): number {
  const normalized = text
    .replace(/,/g, '')
    .replace(/\bone\b/gi, '1')
    .replace(/\btwo\b/gi, '2')
    .replace(/\bthree\b/gi, '3')
    .replace(/\bfour\b/gi, '4')
    .replace(/\bfive\b/gi, '5')
    .replace(/\bten\b/gi, '10')
    .replace(/\btwenty\b/gi, '20')
    .replace(/\bfifty\b/gi, '50')
    .replace(/\bhundred\b/gi, '100');
  const match = normalized.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function findBestEntity<T extends { name: string }>(items: T[], prompt: string, proposedName?: string | null): T | null {
  const haystack = normalizeProductKey(`${prompt} ${proposedName || ''}`);
  const tokens = haystack.split(' ').filter(token => token.length >= 3);

  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const name = normalizeProductKey(item.name);
    let score = haystack.includes(name) || name.includes(haystack) ? 100 : 0;
    for (const token of tokens) {
      if (name.includes(token)) score += token.length;
    }
    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  return best && best.score > 0 ? best.item : null;
}

function buildOverview(prompt: string, products: any[], sales: any[], customers: any[]) {
  const lower = normalizeProductKey(prompt);
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthSales = sales.filter(sale => {
    const date = new Date(sale.date);
    return date.getMonth() === month && date.getFullYear() === year;
  });
  const selectedSales = lower.includes('month') || lower.includes('mahina') || lower.includes('maheena')
    ? monthSales
    : sales;

  const stats: Record<string, { name: string; quantity: number; revenue: number }> = {};
  let revenue = 0;
  for (const sale of selectedSales) {
    revenue += Number(sale.total) || 0;
    for (const item of sale.items || []) {
      const product = products.find(p => p.id === item.productId);
      const name = product?.name || item.name || 'Unknown Product';
      if (!stats[name]) stats[name] = { name, quantity: 0, revenue: 0 };
      stats[name].quantity += Number(item.quantity) || 0;
      stats[name].revenue += (Number(item.quantity) || 0) * (Number(item.price) || 0);
    }
  }

  const top = Object.values(stats).sort((a, b) => b.quantity - a.quantity)[0];
  const lowStock = products.filter(p => Number(p.stock) <= Number(p.lowInventoryThreshold || 10));
  const dues = customers
    .map(c => ({ ...c, dueAmount: (Number(c.totalAmount) || 0) - (Number(c.paidAmount) || 0) }))
    .filter(c => c.dueAmount > 0)
    .sort((a, b) => b.dueAmount - a.dueAmount);

  if (lower.includes('top') || lower.includes('most') || lower.includes('selling') || lower.includes('seller') || lower.includes('zyada')) {
    return top
      ? `${lower.includes('month') ? 'This month' : 'Overall'}, the most selling product is ${top.name}: ${top.quantity} units sold, revenue Rs. ${top.revenue.toFixed(2)}.`
      : 'No sales are recorded for this period yet.';
  }

  if (lower.includes('low stock') || lower.includes('kam stock') || lower.includes('alert')) {
    return lowStock.length
      ? `Low stock products are: ${lowStock.map(p => `${p.name} (${p.stock})`).join(', ')}.`
      : 'All products are above their low-stock thresholds.';
  }

  if (lower.includes('due') || lower.includes('payment') || lower.includes('customer') || lower.includes('udhar')) {
    return dues.length
      ? `Customer dues: ${dues.slice(0, 5).map(c => `${c.name} Rs. ${c.dueAmount.toFixed(2)}`).join(', ')}.`
      : 'No customer dues are pending right now.';
  }

  return `System overview: ${products.length} products, ${selectedSales.length} sales, revenue Rs. ${revenue.toFixed(2)}, ${lowStock.length} low-stock products, and ${dues.length} customers with pending dues.${top ? ` Top product is ${top.name} with ${top.quantity} units sold.` : ''}`;
}

async function runSmartAssistant(prompt: string, products: any[], sales: any[], customers: any[]) {
  const lower = normalizeProductKey(prompt);
  const quantity = Math.max(0, extractFirstNumber(prompt, 1));
  const product = findBestEntity(products, prompt);
  const customer = findBestEntity(customers, prompt);

  const wantsSale = /\b(sale|sell|sold|bill|invoice|checkout|farokht|frokht|bech|bik)\b/.test(lower);
  const wantsAddStock = /\b(add|plus|increase|receive|received|restock|stock in|shamil|jama|daal)\b/.test(lower);
  const wantsRemoveStock = /\b(remove|minus|decrease|deduct|nikal|kam)\b/.test(lower);
  const wantsSetStock = /\b(set|update|make stock|rakh)\b/.test(lower);
  const wantsStockCheck = /\b(stock|available|kitna|check)\b/.test(lower) && !wantsAddStock && !wantsRemoveStock && !wantsSetStock;
  const wantsPayment = /\b(payment|paid|pay|receive payment|clear due|advance|jama|wasool|ada)\b/.test(lower) && customer;
  const wantsOverview = /\b(overview|report|sales|top|selling|seller|revenue|due|dues|low stock|analytics|month|today|summary)\b/.test(lower) && !wantsSale && !wantsPayment && !wantsAddStock && !wantsRemoveStock && !wantsSetStock;

  if (wantsPayment && customer) {
    if (quantity <= 0) {
      return { action: 'error', target: customer.name, quantity: 0, message_ur: 'Please tell me the payment amount.', executed: false };
    }
    const payments = customer.payments || [];
    const payment = {
      id: `PAY-${Date.now().toString().slice(-4)}`,
      amount: quantity,
      date: new Date().toISOString(),
      notes: 'AI Assistant Payment'
    };
    payments.push(payment);
    const newPaidAmount = (Number(customer.paidAmount) || 0) + quantity;
    const { error } = await supabase.from('customers').update({ paid_amount: newPaidAmount, payments }).eq('id', customer.id);
    if (error) throw error;
    const due = (Number(customer.totalAmount) || 0) - newPaidAmount;
    return {
      action: 'pay_customer',
      target: customer.name,
      quantity,
      message_ur: `${customer.name} ki payment Rs. ${quantity} record ho gayi. Remaining due Rs. ${Math.max(0, due).toFixed(2)} hai.`,
      executed: true
    };
  }

  if (wantsOverview || (!product && !customer)) {
    return {
      action: 'general_query',
      product: null,
      target: null,
      quantity: 0,
      message_ur: buildOverview(prompt, products, sales, customers),
      executed: true
    };
  }

  if (!product) {
    return { action: 'error', product: null, quantity: 0, message_ur: 'Product inventory mein nahi mila. Please product name dobara batayein.', executed: false };
  }

  let newStock = Number(product.stock) || 0;
  if (wantsSale || wantsRemoveStock) {
    if (quantity <= 0) return { action: 'error', product: product.name, quantity: 0, message_ur: 'Please quantity batayein.', executed: false };
    if (newStock < quantity) {
      return { action: 'error', product: product.name, quantity, currentStock: newStock, message_ur: `${product.name} ka stock sirf ${newStock} hai, sale/remove ${quantity} nahi ho sakta.`, executed: false };
    }
    newStock -= quantity;
    await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
    if (wantsSale) {
      const total = quantity * (Number(product.price) || 0);
      const sale = {
        id: `ORD-${Date.now().toString().slice(-4)}`,
        total,
        date: new Date().toISOString(),
        items: [{ productId: product.id, name: product.name, quantity, price: product.price }],
        customer_id: customer?.id || null,
        amount_paid: total,
        seller_name: 'AI Assistant'
      };
      const { error } = await supabase.from('sales').insert([sale]);
      if (error) throw error;
    }
    return { action: wantsSale ? 'make_sale' : 'remove_stock', product: product.name, sku: product.sku, quantity, currentStock: newStock, message_ur: `${product.name} ke ${quantity} units ${wantsSale ? 'sale mein record' : 'stock se remove'} ho gaye. New stock ${newStock} hai.`, executed: true };
  }

  if (wantsAddStock) {
    newStock += quantity;
    await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
    return { action: 'add_stock', product: product.name, sku: product.sku, quantity, currentStock: newStock, message_ur: `${product.name} mein ${quantity} units add ho gaye. New stock ${newStock} hai.`, executed: true };
  }

  if (wantsSetStock) {
    newStock = quantity;
    await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
    return { action: 'update_stock', product: product.name, sku: product.sku, quantity, currentStock: newStock, message_ur: `${product.name} ka stock ${newStock} set ho gaya.`, executed: true };
  }

  if (wantsStockCheck || product) {
    return { action: 'check_stock', product: product.name, sku: product.sku, quantity: 0, currentStock: newStock, message_ur: `${product.name} ka current stock ${newStock} units hai. Price Rs. ${Number(product.price || 0).toFixed(2)} hai.`, executed: true };
  }

  return { action: 'error', product: null, quantity: 0, message_ur: 'Command samajh nahi aayi. Please product, quantity, ya report ka naam batayein.', executed: false };
}

function parseVoiceAssistantFallback(prompt: string, products: any[], sales: any[], customers: any[]) {
  const lower = normalizeProductKey(prompt);
  const quantity = Math.max(0, extractFirstNumber(prompt, 0));
  const product = findBestEntity(products, prompt);
  const customer = findBestEntity(customers, prompt);

  const wantsSale = /\b(sale|sell|sold|bill|invoice|checkout|order|farokht|frokht|bech|bik|bika)\b/.test(lower);
  const wantsAddStock = /\b(add|plus|increase|receive|received|restock|stock in|shamil|jama|daal)\b/.test(lower);
  const wantsRemoveStock = /\b(remove|minus|decrease|deduct|nikal|kam)\b/.test(lower);
  const wantsSetStock = /\b(set|update|make stock|rakh)\b/.test(lower);
  const wantsStockCheck = /\b(stock|available|kitna|check|price|rate)\b/.test(lower);
  const wantsPayment = /\b(payment|paid|pay|receive payment|clear due|advance|jama|wasool|ada)\b/.test(lower) && customer;
  const wantsDebt = /\b(udhar|debt|khata|khaty|unpaid|credit)\b/.test(lower) && customer && !product;
  const wantsOverview = /\b(overview|report|sales|top|selling|seller|revenue|due|dues|low stock|analytics|month|today|summary)\b/.test(lower)
    && !wantsSale && !wantsPayment && !wantsAddStock && !wantsRemoveStock && !wantsSetStock;

  if (wantsPayment) {
    return {
      action: 'pay_customer',
      product: null,
      target: customer?.name || null,
      quantity,
      message_ur: customer ? `${customer.name} ki payment record kar raha hoon.` : 'Customer nahi mila.'
    };
  }

  if (wantsDebt) {
    return {
      action: 'add_debt',
      product: null,
      target: customer?.name || null,
      quantity,
      message_ur: customer ? `${customer.name} ke khaty mein amount add kar raha hoon.` : 'Customer nahi mila.'
    };
  }

  if (wantsOverview || (!product && !customer)) {
    return {
      action: 'general_query',
      product: null,
      target: null,
      quantity: 0,
      message_ur: buildOverview(prompt, products, sales, customers)
    };
  }

  if (!product) {
    return {
      action: 'error',
      product: null,
      target: customer?.name || null,
      quantity: 0,
      message_ur: 'Product inventory mein nahi mila. Please product name dobara batayein.'
    };
  }

  const action = wantsSale
    ? 'make_sale'
    : wantsAddStock
      ? 'add_stock'
      : wantsRemoveStock
        ? 'remove_stock'
        : wantsSetStock
          ? 'update_stock'
          : wantsStockCheck
            ? 'check_stock'
            : 'check_stock';

  return {
    action,
    product: product.name,
    target: customer?.name || null,
    quantity: action === 'check_stock' ? 0 : quantity,
    message_ur: `${product.name} ke liye command process kar raha hoon.`
  };
}

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim();
}

async function askGroqJson(systemPrompt: string, userPrompt: string) {
  const groqApiKey = getGroqApiKey();
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is missing in .env");
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${groqApiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.05,
      max_completion_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!groqRes.ok) {
    const details = await groqRes.text().catch(() => "");
    throw new Error(`Groq API returned HTTP ${groqRes.status}${details ? `: ${details.slice(0, 300)}` : ""}`);
  }

  const groqData = await groqRes.json();
  const responseText = (groqData.choices?.[0]?.message?.content || "").trim();
  if (!responseText) {
    throw new Error("Groq returned an empty response");
  }

  return JSON.parse(responseText);
}

function capitalizeText(text: any): any {
  if (typeof text !== "string" || !text) return text;
  return text
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

async function robustInsert(table: string, dbRow: any, excludedColumns: string[] = []): Promise<{ data: any, error: any }> {
  const rowToInsert = { ...dbRow };
  excludedColumns.forEach(col => delete rowToInsert[col]);

  try {
    const { data, error } = await supabase.from(table).insert([rowToInsert]).select();
    
    if (error && error.code === 'PGRST204') {
      const match = error.message.match(/find the '([^']+)' column/);
      if (match && match[1]) {
        const missingColumn = match[1];
        if (missingColumn === 'user_id') return { data: null, error };
        console.warn(`robustInsert: Column '${missingColumn}' not found in table '${table}'. Retrying without it.`);
        return robustInsert(table, dbRow, [...excludedColumns, missingColumn]);
      }
    }
    
    return { data, error };
  } catch (err: any) {
    console.error(`robustInsert internal catch for ${table}:`, err);
    return { data: null, error: err };
  }
}

async function robustUpdate(table: string, dbRow: any, eqKey: string, eqVal: any, excludedColumns: string[] = [], extraFilters: { column: string; value: any }[] = []): Promise<{ data: any, error: any }> {
  const rowToUpdate = { ...dbRow };
  excludedColumns.forEach(col => delete rowToUpdate[col]);

  try {
    let query = supabase.from(table).update(rowToUpdate).eq(eqKey, eqVal);
    extraFilters.forEach(filter => {
      query = query.eq(filter.column, filter.value);
    });
    const { data, error } = await query.select();
    
    if (error && error.code === 'PGRST204') {
      const match = error.message.match(/find the '([^']+)' column/);
      if (match && match[1]) {
        const missingColumn = match[1];
        if (missingColumn === 'user_id') return { data: null, error };
        console.warn(`robustUpdate: Column '${missingColumn}' not found in table '${table}'. Retrying without it.`);
        return robustUpdate(table, dbRow, eqKey, eqVal, [...excludedColumns, missingColumn], extraFilters);
      }
    }
    
    return { data, error };
  } catch (err: any) {
    console.error(`robustUpdate internal catch for ${table}:`, err);
    return { data: null, error: err };
  }
}

async function robustUpsert(table: string, dbRow: any, excludedColumns: string[] = []): Promise<{ data: any, error: any }> {
  const rowToUpsert = { ...dbRow };
  excludedColumns.forEach(col => delete rowToUpsert[col]);

  try {
    const { data, error } = await supabase.from(table).upsert(rowToUpsert).select();

    if (error && error.code === 'PGRST204') {
      const match = error.message.match(/find the '([^']+)' column/);
      if (match && match[1]) {
        const missingColumn = match[1];
        if (missingColumn === 'user_id') return { data: null, error };
        console.warn(`robustUpsert: Column '${missingColumn}' not found in table '${table}'. Retrying without it.`);
        return robustUpsert(table, dbRow, [...excludedColumns, missingColumn]);
      }
    }

    return { data, error };
  } catch (err: any) {
    console.error(`robustUpsert internal catch for ${table}:`, err);
    return { data: null, error: err };
  }
}

export const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", async (req, res, next) => {
  // Allow auth routes (login, signup, verify, etc.) and health check through without JWT
  if (req.path.startsWith("/auth/")) return next();
  if (req.path === "/health") return next();

  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded !== "object" || !("userId" in decoded)) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Fetch live user from database to enforce paid_status and email_verified
    const { data: dbUser, error: dbError } = await supabase.from('users').select('id, email, name, paid_status, email_verified').eq('id', (decoded as any).userId).single();
    
    if (dbError || !dbUser) {
      return res.status(401).json({ error: "User account not found" });
    }

    // Block users who haven't verified their email
    if (dbUser.email_verified === false) {
      return res.status(403).json({ error: "Please verify your email address before using the system." });
    }

    // Block users whose paid_status is false
    if (dbUser.paid_status === false) {
      return res.status(403).json({ error: "Payment delayed. Contact support to restore access." });
    }

    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// In-memory simple DB representations
  const db = {
    products: [] as any[],
    sales: [] as any[],
    categories: [] as any[],
    brands: [] as any[],
    customers: [] as any[],
    users: [] as any[],
    settings: {
      billPrinter: 'Thermal Printer 80mm',
      storeName: 'My Wholesale Store',
      taxRate: 5,
      sellerName: '',
      profilePictureUrl: '',
      profilePicturePublicId: '',
      currency: 'USD',
      defaultLowInventoryThreshold: 10
    }
  };

  // APIs
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = randomUUID();
      const verificationToken = randomBytes(32).toString('hex');
      
      const { data, error } = await supabase.from('users').insert([{ 
        id, 
        email, 
        password: hashedPassword, 
        name,
        email_verified: false,
        verification_token: verificationToken
      }]).select();
      
      if (error) {
        console.error("Supabase signup error:", error);
        return sendDatabaseError(res, error);
      }

      // Send Verification Email
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const origin = process.env.APP_URL || `${protocol}://${host}`;
        const verifyLink = `${origin}/verify-email?token=${verificationToken}`;
        await getEmailTransporter().sendMail({
          from: process.env.SMTP_FROM || '"Apex Distro ERP" <noreply@erp.com>',
          to: email,
          subject: "Verify Your Email Address",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
              <h2 style="color: #4f46e5;">Welcome to Apex Distro ERP!</h2>
              <p style="color: #475569; font-size: 16px;">Hello ${name},</p>
              <p style="color: #475569; font-size: 16px;">Please verify your email address to get started.</p>
              <div style="margin: 30px 0;">
                <a href="${verifyLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="color: #94a3b8; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `
        });
      }

      res.json({ success: true, user: data[0] });
    } catch (e) {
      console.error("Signup internal error:", e);
      sendDatabaseError(res, e);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
      
      if (error || !data || !(await bcrypt.compare(password, data.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (data.email_verified === false) {
        return res.status(403).json({ error: "Please verify your email address before logging in. Check your inbox." });
      }

      if (data.paid_status === false) {
        return res.status(403).json({ error: "Payment delayed. Contact support to restore access." });
      }

      const token = jwt.sign({ userId: data.id, email: data.email }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, user: { id: data.id, email: data.email, name: data.name, paid_status: data.paid_status, email_verified: data.email_verified } });
    } catch (error: any) {
      console.error("Supabase login failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing token" });
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const { data, error } = await supabase.from('users').select('*').eq('id', decoded.userId).single();
      if (error || !data) return res.status(401).json({ error: "User not found" });
      
      res.json({ user: { id: data.id, email: data.email, name: data.name, paid_status: data.paid_status, email_verified: data.email_verified } });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Invalid token" });

      const { data, error } = await supabase.from('users').select('id').eq('verification_token', token).single();
      if (error || !data) return res.status(400).json({ error: "Invalid or expired verification token." });

      await supabase.from('users').update({ email_verified: true, verification_token: null }).eq('id', data.id);
      
      res.json({ success: true, message: "Email successfully verified!" });
    } catch (e) {
      sendDatabaseError(res, e);
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const { data, error } = await supabase.from('users').select('id, name, email, email_verified').eq('email', email).single();
      if (error || !data) {
        return res.json({ success: true, message: "If that email is registered and unverified, a new verification link has been sent." });
      }

      if (data.email_verified) {
        return res.json({ success: true, message: "This email is already verified. You can log in now." });
      }

      const verificationToken = randomBytes(32).toString('hex');
      await supabase.from('users').update({ verification_token: verificationToken }).eq('id', data.id);

      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const origin = process.env.APP_URL || `${protocol}://${host}`;
        const verifyLink = `${origin}/verify-email?token=${verificationToken}`;
        await getEmailTransporter().sendMail({
          from: process.env.SMTP_FROM || '"Apex Distro ERP" <noreply@erp.com>',
          to: data.email,
          subject: "Verify Your Email Address",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
              <h2 style="color: #4f46e5;">Verify your Apex Distro ERP email</h2>
              <p style="color: #475569; font-size: 16px;">Hello ${data.name || "there"},</p>
              <p style="color: #475569; font-size: 16px;">Use this new link to verify your email address.</p>
              <div style="margin: 30px 0;">
                <a href="${verifyLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="color: #94a3b8; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `
        });
      }

      res.json({ success: true, message: "A new verification link has been sent." });
    } catch (e) {
      console.error("Resend verification error:", e);
      sendDatabaseError(res, e);
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const { data, error } = await supabase.from('users').select('id, name').eq('email', email).single();
      
      if (error || !data) {
        // Return success even if email not found to prevent email enumeration
        return res.json({ success: true, message: "If that email is registered, you will receive a reset link." });
      }

      const resetToken = randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 15 * 60000).toISOString(); // 15 mins

      await supabase.from('users').update({ 
        reset_token: resetToken, 
        reset_expires_at: resetExpires 
      }).eq('id', data.id);

      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const origin = process.env.APP_URL || `${protocol}://${host}`;
        const resetLink = `${origin}/reset-password?token=${resetToken}`;
        // Safely format the SMTP_FROM address if it's missing angle brackets but has spaces
        let sender = process.env.SMTP_FROM || '"Apex Distro ERP" <noreply@erp.com>';
        if (sender && !sender.includes('<') && sender.includes(' ')) {
          const parts = sender.split(' ');
          const emailPart = parts.pop();
          sender = `"${parts.join(' ')}" <${emailPart}>`;
        }

        await getEmailTransporter().sendMail({
          from: sender,
          to: email,
          subject: "Password Reset Request",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
              <h2 style="color: #10b981;">Password Reset Request</h2>
              <p style="color: #475569; font-size: 16px;">Hello ${data.name},</p>
              <p style="color: #475569; font-size: 16px;">You requested to reset your password. Click the button below to choose a new password. This link expires in 15 minutes.</p>
              <div style="margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #94a3b8; font-size: 12px;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
            </div>
          `
        });
      }

      res.json({ success: true, message: "If that email is registered, you will receive a reset link." });
    } catch (e) {
      console.error("Forgot password error:", e);
      sendDatabaseError(res, e);
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required" });

      const { data, error } = await supabase.from('users').select('id, reset_expires_at').eq('reset_token', token).single();
      
      if (error || !data) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      if (new Date() > new Date(data.reset_expires_at)) {
        return res.status(400).json({ error: "Reset token has expired" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await supabase.from('users').update({ 
        password: hashedPassword,
        reset_token: null,
        reset_expires_at: null
      }).eq('id', data.id);

      res.json({ success: true, message: "Password has been successfully reset" });
    } catch (e) {
      sendDatabaseError(res, e);
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'products', error);
      const mapped = (data || []).map(mapProduct);
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase products fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });

  app.get("/api/product-lookup/search", async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.json({ suggestions: [] });

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'products', error);

      const normalizedQuery = normalizeProductKey(q);
      const localMatches = (data || [])
        .filter((product: any) => {
          const mapped = mapProduct(product);
          return normalizeProductKey(`${mapped.name} ${mapped.brand || ''} ${mapped.category} ${mapped.barcode} ${mapped.sku}`)
            .includes(normalizedQuery);
        })
        .slice(0, 8)
        .map(mapLocalProductSuggestion);

      if (localMatches.length > 0) {
        return res.json({ suggestions: localMatches, source: 'supabase' });
      }

      // Check search cache before hitting external APIs
      const cacheKey = normalizedQuery;
      const cached = searchResultCache.get(cacheKey);
      if (cached) {
        return res.json({ suggestions: cached, source: 'open_food_facts', cached: true });
      }

      const externalMatches = await searchOpenFoodFacts(q);
      if (externalMatches.length > 0) searchResultCache.set(cacheKey, externalMatches);
      res.json({ suggestions: externalMatches, source: 'open_food_facts' });
    } catch (error: any) {
      console.error("Product lookup search failed:", error);
      res.status(500).json({ error: error.message || "Product lookup failed" });
    }
  });

  app.get("/api/product-lookup/barcode/:barcode", async (req, res) => {
    try {
      const barcode = String(req.params.barcode || '').trim();
      if (!barcode) return res.status(400).json({ error: "Barcode is required" });

      // 1. Check local DB first (always authoritative, no cache)
      const localProduct = await findProductByBarcode(req, barcode);
      if (localProduct) {
        return res.json({
          status: 'found',
          source: 'supabase',
          product: mapLocalProductSuggestion(localProduct),
        });
      }

      // 2. Check in-memory TTL cache
      const cacheKey = barcode.toLowerCase();
      const cached = barcodeResultCache.get(cacheKey);
      if (cached) {
        return res.json({
          status: 'found',
          source: cached.source || 'open_food_facts',
          product: cached,
          cached: true,
        });
      }

      // 3. In-flight de-duplication: reuse an identical pending lookup
      let pending = inflightBarcode.get(cacheKey);
      if (!pending) {
        pending = fetchOpenFoodFactsProductByBarcode(barcode).finally(() => {
          inflightBarcode.delete(cacheKey);
        });
        inflightBarcode.set(cacheKey, pending);
      }

      const externalProduct = await pending;
      if (externalProduct) {
        barcodeResultCache.set(cacheKey, externalProduct);
        return res.json({
          status: 'found',
          source: externalProduct.source || 'open_food_facts',
          product: externalProduct,
        });
      }

      res.json({ status: 'not_found', source: 'none', barcode });
    } catch (error: any) {
      console.error("Barcode lookup failed:", error);
      res.status(500).json({ error: error.message || "Barcode lookup failed" });
    }
  });
  
  app.post("/api/products", async (req, res) => {
    console.log("POST /api/products body:", req.body);
    const { id, name, sku, category, brand, stock, price, barcode, imageUrl, lowInventoryThreshold, unitType, purchasePrice, lastRestock, lastRestockAmount, lastLowStockDate, lastLowStockAmount } = req.body;
    
    const capName = name ? capitalizeText(name) : '';
    const capCategory = category ? capitalizeText(category) : '';
    const capBrand = brand ? capitalizeText(brand) : '';
    try {
      const barcodeDuplicate = await findProductByBarcode(req, barcode);
      if (barcodeDuplicate) {
        await deleteCloudinaryImage(getCloudinaryPublicIdFromUrl(imageUrl));
        return res.status(409).json({
          error: 'Product with this barcode already exists. Add stock to the existing product instead.'
        });
      }

      const duplicate = await findDuplicateProduct(req, capName, capCategory, capBrand);
      if (duplicate) {
        await deleteCloudinaryImage(getCloudinaryPublicIdFromUrl(imageUrl));
        return res.status(409).json({
          error: 'Already existing product with the same name, category, and brand.'
        });
      }
    } catch (error: any) {
      console.error("Duplicate product check failed:", error);
      return sendDatabaseError(res, error, "Failed to check duplicate product");
    }
    
    const parsedSku = buildProductSkuMeta(sku, barcode, lowInventoryThreshold, unitType, purchasePrice, lastRestock, lastRestockAmount, lastLowStockDate, lastLowStockAmount);

    const dbRow = withOwner(req, {
      id: id || randomUUID(),
      name: capName,
      sku: parsedSku,
      stock: stock || 0,
      price: price || 0,
      image_url: imageUrl || '',
      category_id: capCategory,
      brand_id: capBrand
    });

    const { data, error } = await robustInsert('products', dbRow);
    if (error) {
      console.error("Supabase insert product error - message:", error.message);
      console.error("Supabase insert product error - details:", error.details);
      console.error("Supabase insert product error - hint:", error.hint);
      console.error("Supabase insert product error - code:", error.code);
      return sendTenantSchemaError(res, 'products', error);
    }
    
    const p = (data && data.length > 0) ? data[0] : dbRow;
    const mapped = mapProduct(p);
    console.log("Supabase insert product success:", mapped);
    res.json(mapped);
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { name, sku, category, brand, stock, price, barcode, imageUrl, lowInventoryThreshold, unitType, purchasePrice, lastRestock, lastRestockAmount, lastLowStockDate, lastLowStockAmount } = req.body;
      const { data: existingProduct, error: existingError } = await supabase.from('products').select('*').eq('id', req.params.id).eq('user_id', getRequestUserId(req)).single();
      if (existingError && existingError.code !== 'PGRST116') return sendTenantSchemaError(res, 'products', existingError);
      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      const existingSkuMeta = parseProductSkuMeta(existingProduct.sku);
      const nextBarcode = barcode !== undefined ? barcode : existingSkuMeta.barcode;
      const barcodeDuplicate = await findProductByBarcode(req, nextBarcode, req.params.id);
      if (barcodeDuplicate) {
        await deleteCloudinaryImage(getCloudinaryPublicIdFromUrl(imageUrl));
        return res.status(409).json({
          error: 'Product with this barcode already exists. Add stock to the existing product instead.'
        });
      }
      
      const capName = name !== undefined ? capitalizeText(name) : existingProduct.name;
      const capCategory = category !== undefined ? capitalizeText(category) : existingProduct.category_id;
      const capBrand = brand !== undefined ? capitalizeText(brand) : existingProduct.brand_id;
      const duplicate = await findDuplicateProduct(req, capName, capCategory, capBrand, req.params.id);
      if (duplicate) {
        await deleteCloudinaryImage(getCloudinaryPublicIdFromUrl(imageUrl));
        return res.status(409).json({
          error: 'Already existing product with the same name, category, and brand.'
        });
      }

      const parsedSku = buildProductSkuMeta(
        sku !== undefined ? sku : existingSkuMeta.sku,
        nextBarcode,
        lowInventoryThreshold !== undefined ? lowInventoryThreshold : existingSkuMeta.lowInventoryThreshold,
        unitType !== undefined ? unitType : existingSkuMeta.unitType,
        purchasePrice !== undefined ? purchasePrice : existingSkuMeta.purchasePrice,
        lastRestock !== undefined ? lastRestock : existingSkuMeta.lastRestock,
        lastRestockAmount !== undefined ? lastRestockAmount : existingSkuMeta.lastRestockAmount,
        lastLowStockDate !== undefined ? lastLowStockDate : existingSkuMeta.lastLowStockDate,
        lastLowStockAmount !== undefined ? lastLowStockAmount : existingSkuMeta.lastLowStockAmount
      );

      const dbRow: any = {};
      if (name !== undefined) dbRow.name = capName;
      if (sku !== undefined || barcode !== undefined || lowInventoryThreshold !== undefined || unitType !== undefined || purchasePrice !== undefined || lastRestock !== undefined || lastRestockAmount !== undefined || lastLowStockDate !== undefined || lastLowStockAmount !== undefined) {
        dbRow.sku = parsedSku;
      }
      if (stock !== undefined) dbRow.stock = stock;
      if (price !== undefined) dbRow.price = price;
      if (imageUrl !== undefined) dbRow.image_url = imageUrl;
      if (category !== undefined) dbRow.category_id = capCategory;
      if (brand !== undefined) dbRow.brand_id = capBrand;

      const { data, error } = await robustUpdate('products', dbRow, 'id', req.params.id, [], [ownerFilter(req)]);
      if (error) return sendTenantSchemaError(res, 'products', error);
      const oldPublicId = getCloudinaryPublicIdFromUrl(existingProduct?.image_url);
      const newPublicId = getCloudinaryPublicIdFromUrl(imageUrl);
      if (imageUrl !== undefined && oldPublicId && oldPublicId !== newPublicId) {
        await deleteCloudinaryImage(oldPublicId);
      }
      
      const p = (data && data.length > 0) ? data[0] : { ...existingProduct, ...dbRow, id: req.params.id };
      const mapped = mapProduct(p);
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase product update failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { data: product } = await supabase.from('products').select('image_url').eq('id', req.params.id).eq('user_id', getRequestUserId(req)).single();
      const { error } = await supabase.from('products').delete().eq('id', req.params.id).eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'products', error);
      await deleteCloudinaryImage(getCloudinaryPublicIdFromUrl(product?.image_url));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase product delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const { data, error } = await supabase.from('sales').select('*').eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'sales', error);
      
      const mapped = (data || []).map((s: any) => {
        const creditMatch = (s.seller_name || '').match(/\[CREDIT:([\d.]+)\]/);
        const decodedCredit = creditMatch ? parseFloat(creditMatch[1]) : 0;
        const cleanSellerName = s.seller_name ? s.seller_name.replace(/\s*\[CREDIT:[\d.]+\s*\]/, '') : 'Admin';

        return {
          id: s.id,
          total: s.total,
          date: s.date || s.created_at,
          items: s.items || [],
          customerId: s.customer_id,
          amountPaid: s.amount_paid,
          discountAmount: s.discount_amount,
          discountType: s.discount_type,
          discountValue: s.discount_value,
          sellerName: cleanSellerName,
          creditDeducted: s.credit_deducted || decodedCredit || 0
        };
      });
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase sales fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const { items, total, customerId, amountPaid, discountAmount, discountType, discountValue, sellerName, creditDeducted } = req.body;
      
      // 1. Update inventory (with negative stock protection)
      for (const item of items) {
        const { data: product, error: productError } = await supabase.from('products').select('stock').eq('id', item.productId).eq('user_id', getRequestUserId(req)).single();
        if (productError || !product) return res.status(400).json({ error: `Product ${item.name || item.productId} was not found in this profile.` });
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          if (product.stock < item.quantity) {
            return res.status(400).json({ error: `Insufficient stock for product ${item.name || item.productId}. Available: ${product.stock}, Requested: ${item.quantity}` });
          }
          await supabase.from('products').update({ stock: newStock }).eq('id', item.productId).eq('user_id', getRequestUserId(req));
        }
      }

      const isPaidDefined = typeof amountPaid === 'number';
      const finalAmountPaid = isPaidDefined ? amountPaid : total;
      const finalCreditDeducted = typeof creditDeducted === 'number' ? creditDeducted : parseFloat(creditDeducted) || 0;
      const saleId = `ORD-${Date.now().toString().slice(-4)}`;

      const baseSellerName = sellerName ? capitalizeText(sellerName) : 'Admin';
      const encodedSellerName = finalCreditDeducted > 0 
        ? `${baseSellerName} [CREDIT:${finalCreditDeducted}]`
        : baseSellerName;

      const capitalizedItems = Array.isArray(items) ? items.map((item: any) => ({
        ...item,
        name: item.name ? capitalizeText(item.name) : undefined
      })) : items;

      const newSale = withOwner(req, {
        id: saleId,
        total,
        date: new Date().toISOString(),
        items: capitalizedItems,
        customer_id: customerId || null,
        amount_paid: finalAmountPaid,
        discount_amount: typeof discountAmount === 'number' ? discountAmount : undefined,
        discount_type: discountType || undefined,
        discount_value: discountValue || undefined,
        seller_name: encodedSellerName,
        credit_deducted: finalCreditDeducted // Safe column if it exists in Postgres
      });

      // 2. Insert Sale
      const { data: saleData, error: saleError } = await robustInsert('sales', newSale);
      if (saleError) return sendTenantSchemaError(res, 'sales', saleError);

      // 3. Update customer
      if (customerId) {
        const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).eq('user_id', getRequestUserId(req)).single();
        if (customer) {
            const payments = customer.payments || [];
            
            // Log credit deduction in payment journal if applicable
            if (finalCreditDeducted > 0) {
              payments.push({
                id: `PAY-${Date.now().toString().slice(-4)}`,
                amount: finalCreditDeducted,
                date: new Date().toISOString(),
                notes: `Advance Credit Deducted (Sale ID ${saleId})`
              });
            }

            // Log remaining cash paid at checkout
            if (finalAmountPaid > 0) {
              payments.push({
                id: `PAY-${Date.now().toString().slice(-4)}`,
                amount: finalAmountPaid,
                date: new Date().toISOString(),
                notes: `Cash checkout payment (Sale ID ${saleId})`
              });
            }

            await supabase.from('customers').update({
                total_amount: (customer.total_amount || 0) + total,
                paid_amount: (customer.paid_amount || 0) + finalAmountPaid,
                payments: payments
            }).eq('id', customerId).eq('user_id', getRequestUserId(req));
        }
      }
    
      const s = saleData[0] || newSale; // Fallback to newSale structure if insert select failed
      const mapped = {
        id: s.id || saleId,
        total: s.total,
        date: s.date,
        items: s.items || [],
        customerId: s.customer_id,
        amountPaid: s.amount_paid,
        discountAmount: s.discount_amount,
        discountType: s.discount_type,
        discountValue: s.discount_value,
        sellerName: baseSellerName,
        creditDeducted: finalCreditDeducted
      };
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase sale create failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const { data: sale, error: saleFetchError } = await supabase.from('sales').select('*').eq('id', req.params.id).eq('user_id', getRequestUserId(req)).single();
      if (saleFetchError && saleFetchError.code !== 'PGRST116') return sendTenantSchemaError(res, 'sales', saleFetchError);
      if (!sale) return res.status(404).json({ error: 'Not found' });

      // Restock
      if (sale.items) {
        for (const item of sale.items) {
           const { data: product } = await supabase.from('products').select('stock').eq('id', item.productId).eq('user_id', getRequestUserId(req)).single();
           if (product) {
             await supabase.from('products').update({ stock: product.stock + item.quantity }).eq('id', item.productId).eq('user_id', getRequestUserId(req));
           }
        }
      }
      
      // Update customer stats
      const custId = sale.customer_id;
      if (custId) {
        const { data: customer } = await supabase.from('customers').select('*').eq('id', custId).eq('user_id', getRequestUserId(req)).single();
        if (customer) {
            await supabase.from('customers').update({
                total_amount: Math.max(0, (customer.total_amount || 0) - sale.total),
                paid_amount: Math.max(0, (customer.paid_amount || 0) - (sale.amount_paid || sale.total)),
                payments: (customer.payments || []).filter((p: any) => !p.notes?.includes(sale.id))
            }).eq('id', custId).eq('user_id', getRequestUserId(req));
        }
      }

      const { error } = await supabase.from('sales').delete().eq('id', req.params.id).eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'sales', error);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase sale delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const { data, error } = await supabase.from('categories').select('*').eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'categories', error);
      res.json(data);
    } catch (error: any) {
      console.error("Supabase categories fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const rawName = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!rawName) {
        return res.status(400).json({ error: "Category name cannot be empty" });
      }

      const userId = getRequestUserId(req);
      const { data: existingCategory, error: existingError } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', rawName)
        .maybeSingle();
      if (existingError) return sendTenantSchemaError(res, 'categories', existingError);
      if (existingCategory) {
        return res.status(409).json({ error: "Category already exists" });
      }

      const capitalizedData = {
        ...req.body,
        name: capitalizeText(rawName),
      };
      const { data, error } = await supabase.from('categories').insert([{ ...capitalizedData, id: randomUUID(), user_id: userId }]).select();
      if (error) return sendTenantSchemaError(res, 'categories', error);
      res.json(data[0]);
    } catch (error: any) {
      console.error("Supabase category create failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', req.params.id).eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'categories', error);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase category delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.get("/api/brands", async (req, res) => {
    try {
      const { data, error } = await supabase.from('brands').select('*').eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'brands', error);
      res.json(data);
    } catch (error: any) {
      console.error("Supabase brands fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });

  app.post("/api/brands", async (req, res) => {
    try {
      const rawName = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!rawName) {
        return res.status(400).json({ error: "Brand name cannot be empty" });
      }

      const userId = getRequestUserId(req);
      const { data: existingBrand, error: existingError } = await supabase
        .from('brands')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', rawName)
        .maybeSingle();
      if (existingError) return sendTenantSchemaError(res, 'brands', existingError);
      if (existingBrand) {
        return res.status(409).json({ error: "Brand already exists" });
      }

      const capitalizedData = {
        ...req.body,
        name: capitalizeText(rawName),
      };
      const { data, error } = await supabase.from('brands').insert([{ ...capitalizedData, id: randomUUID(), user_id: userId }]).select();
      if (error) return sendTenantSchemaError(res, 'brands', error);
      res.json(data[0]);
    } catch (error: any) {
      console.error("Supabase brand create failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.delete("/api/brands/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('brands').delete().eq('id', req.params.id).eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'brands', error);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase brand delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.post("/api/upload-image", async (req, res) => {
    try {
      const { dataUrl } = req.body;
      if (!configureCloudinary()) {
        return res.status(500).json({ error: 'Cloudinary is not configured. Check CLOUDINARY_* values in .env.' });
      }
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'dataUrl is required' });
      }
      const result = await cloudinary.uploader.upload(dataUrl, {
        folder: CLOUDINARY_FOLDER,
        resource_type: "image",
        transformation: [
          { quality: "auto:eco", fetch_format: "auto" }
        ],
      });
      res.json({ url: result.secure_url, public_id: result.public_id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  app.post("/api/delete-image", async (req, res) => {
    try {
      const { public_id } = req.body;
      await deleteCloudinaryImage(public_id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('user_id', getRequestUserId(req)).single();
      if (error) {
        if (error.code !== 'PGRST116') return sendTenantSchemaError(res, 'settings', error);
        // Return default if not found, or handle error
        res.json(mapSettings());
      } else {
        res.json(mapSettings(data));
      }
    } catch (error: any) {
      console.error("Supabase settings fetch failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const userId = getRequestUserId(req);
      const { data: existingSettings } = await supabase.from('settings').select('*').eq('user_id', userId).single();
      const oldPublicId = existingSettings?.profilePicturePublicId
        || existingSettings?.profile_picture_public_id
        || getCloudinaryPublicIdFromUrl(existingSettings?.profilePictureUrl || existingSettings?.profile_picture_url);
      const nextPublicId = req.body.profilePicturePublicId
        || req.body.profile_picture_public_id
        || getCloudinaryPublicIdFromUrl(req.body.profilePictureUrl || req.body.profile_picture_url);

      const settingsRow = { ...mapSettingsToDb(req.body), user_id: userId };
      let result = existingSettings?.id
        ? await robustUpdate('settings', settingsRow, 'id', existingSettings.id, [], [ownerFilter(req)])
        : await robustInsert('settings', settingsRow);

      if (result.error?.code === '23505') {
        result = await robustUpdate('settings', settingsRow, 'user_id', userId);
      }

      const { data, error } = result;
      if (error) return sendTenantSchemaError(res, 'settings', error);
      if (oldPublicId && oldPublicId !== nextPublicId) {
        await deleteCloudinaryImage(oldPublicId);
      }
      res.json(mapSettings(data?.[0] || settingsRow));
    } catch (error: any) {
      console.error("Supabase settings update failed:", error);
      sendDatabaseError(res, error);
    }
  });

  // Customer APIs
  app.get("/api/customers", async (req, res) => {
    try {
      const { data, error } = await supabase.from('customers').select('*').eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'customers', error);
      const mapped = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        totalAmount: c.total_amount || 0,
        paidAmount: c.paid_amount || 0,
        payments: c.payments || []
      }));
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase customers fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      console.log("POST /api/customers body:", req.body);
      const { name, phone, email, address, totalAmount, paidAmount, payments } = req.body;
      const capName = name ? capitalizeText(name) : '';
      const capAddress = address ? capitalizeText(address) : '';

      const dbRow = withOwner(req, {
        id: req.body.id || randomUUID(),
        name: capName,
        phone: phone || '',
        email: email || '',
        address: capAddress,
        total_amount: totalAmount || 0,
        paid_amount: paidAmount || 0,
        payments: payments || []
      });

      const { data, error } = await robustInsert('customers', dbRow);
      if (error) {
        console.error("Supabase insert customer error - message:", error.message);
        console.error("Supabase insert customer error - details:", error.details);
        console.error("Supabase insert customer error - code:", error.code);
        return sendTenantSchemaError(res, 'customers', error);
      }
      
      const c = (data && data.length > 0) ? data[0] : dbRow;
      const mapped = {
        id: c.id || dbRow.id,
        name: c.name || dbRow.name,
        phone: c.phone || dbRow.phone,
        email: c.email || dbRow.email,
        address: c.address || dbRow.address,
        totalAmount: c.total_amount !== undefined ? c.total_amount : dbRow.total_amount,
        paidAmount: c.paid_amount !== undefined ? c.paid_amount : dbRow.paid_amount,
        payments: c.payments || dbRow.payments
      };
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase customer create failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const { name, phone, email, address, totalAmount, paidAmount, payments } = req.body;
      const capName = name ? capitalizeText(name) : undefined;
      const capAddress = address ? capitalizeText(address) : undefined;

      const dbRow: any = {};
      if (name !== undefined) dbRow.name = capName;
      if (phone !== undefined) dbRow.phone = phone;
      if (email !== undefined) dbRow.email = email;
      if (address !== undefined) dbRow.address = capAddress;
      if (totalAmount !== undefined) dbRow.total_amount = totalAmount;
      if (paidAmount !== undefined) dbRow.paid_amount = paidAmount;
      if (payments !== undefined) dbRow.payments = payments;

      const { data, error } = await robustUpdate('customers', dbRow, 'id', req.params.id, [], [ownerFilter(req)]);
      if (error) return sendTenantSchemaError(res, 'customers', error);
      
      const c = (data && data.length > 0) ? data[0] : { ...dbRow, id: req.params.id };
      const mapped = {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        totalAmount: c.total_amount !== undefined ? c.total_amount : 0,
        paidAmount: c.paid_amount !== undefined ? c.paid_amount : 0,
        payments: c.payments || []
      };
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase customer update failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', req.params.id).eq('user_id', getRequestUserId(req));
      if (error) return sendTenantSchemaError(res, 'customers', error);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase customer delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.post("/api/customers/:id/payments", async (req, res) => {
    try {
      const { data: customer, error: fetchError } = await supabase.from('customers').select('*').eq('id', req.params.id).eq('user_id', getRequestUserId(req)).single();
      if (fetchError || !customer) return res.status(404).json({ error: "Customer not found" });

      const { amount, notes } = req.body;
      const amt = parseFloat(amount) || 0;
      
      const payments = customer.payments || [];
      payments.push({
        id: `PAY-${Date.now().toString().slice(-4)}`,
        amount: amt,
        date: new Date().toISOString(),
        notes: notes ? capitalizeText(notes) : "Direct Payment Ledger Update"
      });

      const updatePayload = {
        paid_amount: (customer.paid_amount || 0) + amt,
        payments: payments
      };

      const { data, error: updateError } = await robustUpdate('customers', updatePayload, 'id', req.params.id, [], [ownerFilter(req)]);

      if (updateError) return sendTenantSchemaError(res, 'customers', updateError);
      
      const c = (data && data.length > 0) ? data[0] : { ...customer, ...updatePayload };
      const mapped = {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        totalAmount: c.total_amount !== undefined ? c.total_amount : 0,
        paidAmount: c.paid_amount !== undefined ? c.paid_amount : 0,
        payments: c.payments || []
      };
      res.json({ customer: mapped, payment: payments[payments.length - 1] });
    } catch (error: any) {
      console.error("Supabase customer payment failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { prompt } = req.body;
      const { data: dbProducts, error: productsError } = await supabase.from('products').select('*').eq('user_id', getRequestUserId(req));
      const { data: dbSales, error: salesError } = await supabase.from('sales').select('*').eq('user_id', getRequestUserId(req));
      const { data: dbCustomers, error: customersError } = await supabase.from('customers').select('*').eq('user_id', getRequestUserId(req));
      if (productsError) return sendTenantSchemaError(res, 'products', productsError);
      if (salesError) return sendTenantSchemaError(res, 'sales', salesError);
      if (customersError) return sendTenantSchemaError(res, 'customers', customersError);
      const mappedProducts = (dbProducts || []).map((p: any) => {
        const [realSku, barcode, lowThresholdStr] = (p.sku || '').split('::');
        return {
          id: p.id,
          name: p.name,
          sku: realSku || p.sku,
          barcode: barcode || '',
          lowInventoryThreshold: lowThresholdStr ? parseInt(lowThresholdStr, 10) : undefined,
          stock: p.stock,
          price: p.price,
          imageUrl: p.image_url || '',
          category: p.category_id || '',
          brand: p.brand_id || ''
        };
      });

      const mappedSales = (dbSales || []).map((s: any) => ({
        id: s.id,
        total: s.total || 0,
        date: s.date,
        items: s.items || [],
        customerId: s.customer_id,
        amountPaid: s.amount_paid || 0
      }));

      const mappedCustomers = (dbCustomers || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        totalAmount: c.total_amount || 0,
        paidAmount: c.paid_amount || 0,
        dueAmount: (c.total_amount || 0) - (c.paid_amount || 0)
      }));

      const parsed = await askGroqJson(`You are a sharp wholesale ERP analyst. Answer using live JSON data only.
Return ONLY JSON in this shape: {"reply":"clear helpful answer in English or Roman Urdu"}.
Products: ${JSON.stringify(mappedProducts)}
Sales: ${JSON.stringify(mappedSales)}
Customers: ${JSON.stringify(mappedCustomers)}`, prompt);

      res.json({ reply: parsed.reply || "No answer generated." });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to contact Groq AI" });
    }
  });

  app.post("/api/ai/voice-assistant", async (req, res) => {
    const { prompt, sellerName } = req.body;
    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: "Voice command text is required" });
    }

    // Retrieve active items from Supabase database
    const { data: dbProducts, error: productsError } = await supabase.from('products').select('*').eq('user_id', getRequestUserId(req));
    const { data: dbSales, error: salesError } = await supabase.from('sales').select('*').eq('user_id', getRequestUserId(req));
    const { data: dbCustomers, error: customersError } = await supabase.from('customers').select('*').eq('user_id', getRequestUserId(req));
    if (productsError) return sendTenantSchemaError(res, 'products', productsError);
    if (salesError) return sendTenantSchemaError(res, 'sales', salesError);
    if (customersError) return sendTenantSchemaError(res, 'customers', customersError);

    const mappedProducts = (dbProducts || []).map((p: any) => {
      const [realSku, barcode, lowThresholdStr] = (p.sku || '').split('::');
      return {
        id: p.id,
        name: p.name,
        sku: realSku || p.sku,
        barcode: barcode || '',
        lowInventoryThreshold: lowThresholdStr ? parseInt(lowThresholdStr, 10) : undefined,
        stock: p.stock || 0,
        price: p.price || 0,
        imageUrl: p.image_url || '',
        category: p.category_id || '',
        brand: p.brand_id || ''
      };
    });

    const mappedSales = (dbSales || []).map((s: any) => ({
      id: s.id,
      total: s.total || 0,
      date: s.date,
      items: s.items || [],
      customerId: s.customer_id,
      amountPaid: s.amount_paid,
      discountAmount: s.discount_amount,
      discountType: s.discount_type,
      discountValue: s.discount_value,
      sellerName: s.seller_name
    }));

    // Calculate precise sales metrics dynamically
    const salesStats: Record<string, { quantity: number; revenue: number }> = {};
    let totalSalesRevenue = 0;
    
    mappedSales.forEach(sale => {
      totalSalesRevenue += sale.total;
      if (Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!salesStats[item.productId]) {
            salesStats[item.productId] = { quantity: 0, revenue: 0 };
          }
          salesStats[item.productId].quantity += item.quantity || 0;
          salesStats[item.productId].revenue += (item.quantity || 0) * (item.price || 0);
        });
      }
    });

    const productsWithSales = mappedProducts.map(p => {
      const stats = salesStats[p.id] || { quantity: 0, revenue: 0 };
      return {
        name: p.name,
        stock: p.stock,
        price: p.price,
        unitsSold: stats.quantity,
        revenueMade: stats.revenue
      };
    });

    const mappedCustomers = (dbCustomers || []).map((c: any) => {
      const customerSales = mappedSales.filter(s => s.customerId === c.id);
      const purchasedProducts = customerSales.flatMap(s => Array.isArray(s.items) ? s.items.map((i: any) => `${i.name} (${i.quantity}x)`) : []);
      
      return {
        id: c.id,
        name: c.name,
        totalAmount: c.total_amount || 0,
        paidAmount: c.paid_amount || 0,
        dueAmount: (c.total_amount || 0) - (c.paid_amount || 0),
        payments: c.payments || [],
        purchasedHistory: purchasedProducts.join(", ")
      };
    });

    let parsed = null;
    let fallbackUsed = false;

    try {
      const systemPrompt = `You are a production-grade Voice AI Assistant for a Wholesale ERP system.
Your goal is to parse user vocal commands (in Urdu, English, Roman Urdu, or a mix of these) and translate them into a perfectly formatted JSON output.

Current Context:
- Today's Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Keep the current season/weather in mind for smart recommendations.

Here are the current Live ERP Statistics from our database:
- Total Sales Orders Registered: ${mappedSales.length}
- Total Sales Revenue Made: Rs. ${totalSalesRevenue}
- Live Products Catalog (including stock, price, and units sold):
${JSON.stringify(productsWithSales)}
- Live Customers list (including dues and advance credit, positive dueAmount means owes money, negative dueAmount means advance credit):
${JSON.stringify(mappedCustomers)}

Instructions:
1. Select exactly one action:
   - "add_stock": add units into inventory.
   - "remove_stock": remove inventory without creating a sale.
   - "update_stock": set a product stock to an exact number.
   - "check_stock": answer stock or price availability.
   - "make_sale": create a sale/bill/invoice/order and reduce stock. Use for sell, sold, sale, bill, invoice, checkout, bech do, farokht. (Must have a specific product).
   - "pay_customer": STRICTLY for when a customer GIVES us money (payment received, paisy diye, wasooli). This reduces their dues.
   - "add_debt": STRICTLY for when we give goods/credit to a customer but NO specific product is named (e.g., "500 ka saman gya rao zeshan ka", "unpaid hai", "khaty mein likho"). This increases their dues.
   - "general_query": system overview, top seller, sales report, revenue, this month, low stock, customer dues, analytics, OR smart product recommendations based on season/sales.
   - "error": command is unclear or missing required info.
2. For product actions, put the closest live product name in "product".
3. For customer payment, customer sale, or adding debt, put the closest live customer name in "target"; otherwise null.
4. "quantity" means units for stock/sales and money amount for customer payments/debt.
5. For general_query, answer from live stats directly in message_ur with exact numbers, and give smart seasonal recommendations if asked.
6. Do not invent products or customers. If uncertain, use "error".
7. message_ur must be a complete Roman Urdu or English spoken sentence.
8. ALWAYS output ONLY a raw valid JSON object. DO NOT wrap it in markdown code blocks.

Strict Output Format:
{
  "action": "add_stock" | "remove_stock" | "update_stock" | "check_stock" | "make_sale" | "pay_customer" | "add_debt" | "general_query" | "error",
  "product": "name of product or null",
  "target": "name of customer for payments/sales/debt, or null",
  "quantity": number,
  "message_ur": "Complete continuous natural Urdu explanation summarizing the report/result or answer."
}`;

      parsed = await askGroqJson(systemPrompt, prompt);
    } catch (e: any) {
      console.error("Groq assistant failed:", e.message);
      parsed = parseVoiceAssistantFallback(prompt, mappedProducts, mappedSales, mappedCustomers);
      fallbackUsed = true;
    }

    try {
      // --- BACKEND VALIDATION LAYER ---
      const { action: proposedAction, product: proposedProduct, target: proposedTarget, quantity: proposedQuantityVal, message_ur } = parsed;
      const quantityNum = Math.max(0, parseInt(proposedQuantityVal) || 0);

      // Handle general informational query directly
      if (proposedAction === "general_query" || proposedAction === "speak_info") {
        return res.json({
          action: "general_query",
          product: null,
          target: null,
          sku: null,
          quantity: 0,
          message_ur: message_ur || "جی میں آپ کی مدد کے لیے حاضر ہوں۔",
          executed: true
        });
      }

      if (proposedAction === "pay_customer") {
        let matchCustomer = mappedCustomers.find(c => c.name.toLowerCase().includes((proposedTarget || '').toLowerCase()));
        if (!matchCustomer) {
           return res.json({ action: "error", message_ur: "Customer not found. Kist customer ki payment hai?", executed: false });
        }
        
        // Fetch fresh customer data from DB to avoid stale cache
        const { data: freshCust } = await supabase.from('customers').select('*').eq('id', matchCustomer.id).eq('user_id', getRequestUserId(req)).single();
        const currentPaidAmount = freshCust?.paid_amount || matchCustomer.paidAmount || 0;
        const newPaidAmount = currentPaidAmount + quantityNum;
        const aiSellerLabel = 'AI Voice Assistant';
        
        // Add payment to ledger history
        const payments = freshCust?.payments || [];
        payments.push({
          id: `PAY-${Date.now().toString().slice(-4)}`,
          amount: quantityNum,
          date: new Date().toISOString(),
          notes: `Payment received via ${aiSellerLabel}`
        });

        await supabase.from('customers').update({ 
          paid_amount: newPaidAmount,
          payments: payments
        }).eq('id', matchCustomer.id).eq('user_id', getRequestUserId(req));
        
        return res.json({
           action: "pay_customer",
           target: matchCustomer.name,
           quantity: quantityNum,
           message_ur: message_ur || `${matchCustomer.name} ki Rs. ${quantityNum} ki payment likh li gayi hai.`,
           executed: true
        });
      }

      if (proposedAction === "add_debt") {
        let matchCustomer = mappedCustomers.find(c => c.name.toLowerCase().includes((proposedTarget || '').toLowerCase()));
        if (!matchCustomer) {
           return res.json({ action: "error", message_ur: "Customer not found. Kis ka khata hai?", executed: false });
        }
        
        // Fetch fresh customer data from DB to avoid stale cache issues
        const { data: freshCust } = await supabase.from('customers').select('*').eq('id', matchCustomer.id).eq('user_id', getRequestUserId(req)).single();
        const currentTotalAmount = freshCust?.total_amount || matchCustomer.totalAmount || 0;
        const newTotalAmount = currentTotalAmount + quantityNum;
        
        const saleId = `ORD-${Date.now().toString().slice(-4)}`;
        const saleDate = new Date().toISOString();
        const aiSellerLabel = 'AI Voice Assistant';
        
        // Update customer payments journal for history tracking
        const payments = freshCust?.payments || [];
        payments.push({
          id: `PUR-${Date.now().toString().slice(-4)}`,
          amount: quantityNum,
          date: saleDate,
          notes: `Udhar/Credit Purchase Rs. ${quantityNum.toLocaleString()} added by ${aiSellerLabel} (Sale ID ${saleId})`
        });

        await supabase.from('customers').update({ 
          total_amount: newTotalAmount,
          payments: payments
        }).eq('id', matchCustomer.id).eq('user_id', getRequestUserId(req));
        
        // Create a formal Sale record for tracking in Sales page
        const newSale = withOwner(req, {
          id: saleId,
          total: quantityNum,
          date: saleDate,
          items: [
            {
              productId: "general-credit",
              name: "General Credit/Udhar (Added by AI)",
              quantity: 1,
              price: quantityNum
            }
          ],
          customer_id: matchCustomer.id,
          amount_paid: 0,
          seller_name: aiSellerLabel
        });
        const { error: saleError } = await robustInsert('sales', newSale);
        if (saleError) console.error("add_debt sales insert error:", saleError);
        
        return res.json({
           action: "add_debt",
           target: matchCustomer.name,
           quantity: quantityNum,
           message_ur: message_ur || `Ji, ${matchCustomer.name} ke khaty mein Rs. ${quantityNum} ka udhar likh diya gaya hai.`,
           executed: true
        });
      }

      // Verify mapped product actually exists in database
      let matchProduct = mappedProducts.find(
        p => p.name.toLowerCase() === proposedProduct?.toLowerCase()
      );

      // 1. Generic live inventory matching by AI product name and original prompt.
      if (!matchProduct) {
        matchProduct = findBestEntity(mappedProducts, prompt, proposedProduct);
      }

      // 2. Case-insensitive substring mapping for partial names/SKUs/barcodes.
      if (!matchProduct && proposedProduct) {
        const cleanProposed = proposedProduct.toLowerCase().trim();
        matchProduct = mappedProducts.find(p => {
          const dbName = p.name.toLowerCase();
          const dbSku = String(p.sku || '').toLowerCase();
          const dbBarcode = String(p.barcode || '').toLowerCase();
          return dbName.includes(cleanProposed)
            || cleanProposed.includes(dbName)
            || (!!dbSku && (dbSku.includes(cleanProposed) || cleanProposed.includes(dbSku)))
            || (!!dbBarcode && (dbBarcode.includes(cleanProposed) || cleanProposed.includes(dbBarcode)));
        });
      }

      // 3. Raw prompt backup scanner across every live product, SKU, and barcode.
      if (!matchProduct && prompt) {
        const rawPrompt = prompt.toLowerCase();
        matchProduct = mappedProducts.find(p => {
          const dbName = p.name.toLowerCase();
          const dbSku = String(p.sku || '').toLowerCase();
          const dbBarcode = String(p.barcode || '').toLowerCase();
          return rawPrompt.includes(dbName)
            || dbName.includes(rawPrompt)
            || (!!dbSku && rawPrompt.includes(dbSku))
            || (!!dbBarcode && rawPrompt.includes(dbBarcode));
        });
      }

      if (!matchProduct || proposedAction === "error") {
        return res.json({
          action: "error",
          product: proposedProduct || null,
          quantity: 0,
          message_ur: "یہ پروڈکٹ موجود نہیں ہے",
          executed: false
        });
      }

      // Execute safely in the database
      let executed = false;
      let finalNewStock = matchProduct.stock;
      
      if (proposedAction === "add_stock") {
        finalNewStock = matchProduct.stock + quantityNum;
        await supabase.from('products').update({ stock: finalNewStock }).eq('id', matchProduct.id).eq('user_id', getRequestUserId(req));
        executed = true;
      } else if (proposedAction === "remove_stock" || proposedAction === "make_sale") {
        if (quantityNum <= 0) {
          return res.json({
            action: "error",
            product: matchProduct.name,
            quantity: 0,
            message_ur: "Quantity zaroori hai.",
            executed: false,
            currentStock: matchProduct.stock
          });
        }
        if (matchProduct.stock < quantityNum) {
          return res.json({
            action: "error",
            product: matchProduct.name,
            quantity: quantityNum,
            message_ur: `${matchProduct.name} ka stock sirf ${matchProduct.stock} hai.`,
            executed: false,
            currentStock: matchProduct.stock
          });
        }
        finalNewStock = matchProduct.stock - quantityNum;
        await supabase.from('products').update({ stock: finalNewStock }).eq('id', matchProduct.id).eq('user_id', getRequestUserId(req));
        
        if (proposedAction === "make_sale") {
          const matchCustomer: any = findBestEntity(mappedCustomers, prompt, proposedTarget);
          const totalValue = quantityNum * matchProduct.price;
          const saleId = `ORD-${Date.now().toString().slice(-4)}`;
          const saleDate = new Date().toISOString();
          const aiSellerLabel = 'AI Voice Assistant';
          
          let amountPaid = totalValue;
          
          if (matchCustomer) {
            // For a regular customer, we assume it's on credit (0 paid) by default
            amountPaid = 0;
            
            // Fetch fresh customer data from DB to avoid stale cache
            const { data: freshCust } = await supabase.from('customers').select('*').eq('id', matchCustomer.id).eq('user_id', getRequestUserId(req)).single();
            const currentTotalAmount = freshCust?.total_amount || matchCustomer.totalAmount || 0;
            const newTotalAmount = currentTotalAmount + totalValue;
            
            // Update customer payments journal for purchase history tracking
            const payments = freshCust?.payments || [];
            payments.push({
              id: `PUR-${Date.now().toString().slice(-4)}`,
              amount: totalValue,
              date: saleDate,
              notes: `Purchase: ${quantityNum}x ${matchProduct.name} @ Rs. ${matchProduct.price} — by ${aiSellerLabel} (Sale ID ${saleId})`
            });

            await supabase.from('customers').update({ 
              total_amount: newTotalAmount,
              payments: payments
            }).eq('id', matchCustomer.id).eq('user_id', getRequestUserId(req));
          }

          const newSale = withOwner(req, {
            id: saleId,
            total: totalValue,
            date: saleDate,
            items: [
              {
                productId: matchProduct.id,
                name: matchProduct.name,
                quantity: quantityNum,
                price: matchProduct.price
              }
            ],
            customer_id: matchCustomer?.id || null,
            amount_paid: amountPaid,
            seller_name: aiSellerLabel
          });
          const { error: saleError } = await robustInsert('sales', newSale);
          if (saleError) console.error("make_sale sales insert error:", saleError);
        }
        
        executed = true;
      } else if (proposedAction === "update_stock") {
        finalNewStock = quantityNum;
        await supabase.from('products').update({ stock: finalNewStock }).eq('id', matchProduct.id).eq('user_id', getRequestUserId(req));
        executed = true;
      } else if (proposedAction === "check_stock") {
        executed = true;
      }

      return res.json({
        action: proposedAction,
        product: matchProduct.name,
        sku: matchProduct.sku,
        quantity: quantityNum,
        message_ur: parsed.message_ur || `آپ کی درخواست پر عمل کر دیا گیا ہے۔`,
        executed: executed,
        currentStock: finalNewStock
      });

    } catch (e: any) {
      console.error("Error in assistant API processing:", e);
      return res.status(200).json({
        action: "error",
        product: null,
        quantity: 0,
        message_ur: "معذرت، کارروائی کے دوران کچھ خرابی پیش آئی ہے۔ برائے مہربانی دوبارہ بولیں۔",
        executed: false,
        error: e.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    (async () => {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      
      if (!process.env.VERCEL) {
        app.listen(PORT, "0.0.0.0", () => {
          console.log(`Server running on port ${PORT}`);
        });
      }
    })();
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
