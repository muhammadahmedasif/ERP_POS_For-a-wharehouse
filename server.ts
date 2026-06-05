import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
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
    throw new Error(`${name} is missing in .env`);
  }
  return value;
}

const JWT_SECRET = process.env.JWT_SECRET?.trim() || randomUUID();
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});



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
    currency: settings.currency || 'USD',
    defaultLowInventoryThreshold: Number(settings.defaultLowInventoryThreshold ?? settings.default_low_inventory_threshold ?? 10),
  };
}

function mapSettingsToDb(settings: any = {}) {
  const mapped = mapSettings(settings);
  return {
    billPrinter: mapped.billPrinter,
    storeName: mapped.storeName,
    taxRate: mapped.taxRate,
    sellerName: mapped.sellerName,
    profilePictureUrl: mapped.profilePictureUrl,
    profilePicturePublicId: mapped.profilePicturePublicId,
    defaultLowInventoryThreshold: mapped.defaultLowInventoryThreshold,
    bill_printer: mapped.billPrinter,
    store_name: mapped.storeName,
    tax_rate: mapped.taxRate,
    seller_name: mapped.sellerName,
    profile_picture_url: mapped.profilePictureUrl,
    profile_picture_public_id: mapped.profilePicturePublicId,
    default_low_inventory_threshold: mapped.defaultLowInventoryThreshold,
    currency: mapped.currency,
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

  if (causeCode === "ENOTFOUND" || causeMessage.includes("ENOTFOUND")) {
    return `Supabase host cannot be resolved. Check SUPABASE_URL in .env. Current host: ${SUPABASE_URL}`;
  }

  if (causeMessage.includes("fetch failed")) {
    return `Could not connect to Supabase. Check SUPABASE_URL in .env. Current host: ${SUPABASE_URL}`;
  }

  return causeMessage;
}

function sendDatabaseError(res: express.Response, error: any, fallback = "Database request failed") {
  const message = formatDatabaseError(error);
  return res.status(500).json({ error: message || fallback });
}

function mapProduct(p: any) {
  const [realSku, barcode, lowThresholdStr] = (p.sku || '').split('::');
  const imageUrl = p.image_url || '';
  return {
    id: p.id,
    name: p.name,
    sku: realSku || p.sku,
    barcode: barcode || '',
    lowInventoryThreshold: lowThresholdStr ? parseInt(lowThresholdStr, 10) : undefined,
    stock: Number(p.stock) || 0,
    price: Number(p.price) || 0,
    imageUrl,
    publicId: getCloudinaryPublicIdFromUrl(imageUrl),
    category: p.category_id || '',
    brand: p.brand_id || ''
  };
}

function normalizeProductKey(value: any): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeBrandKey(value: any): string {
  const normalized = normalizeProductKey(value);
  if (!normalized || normalized === 'unbranded' || normalized === 'unbranded / generic' || normalized === 'generic') {
    return 'unbranded / generic';
  }
  return normalized;
}

async function findDuplicateProduct(name: any, category: any, brand: any, excludeId?: string) {
  const normalizedName = normalizeProductKey(capitalizeText(name));
  const normalizedCategory = normalizeProductKey(capitalizeText(category));
  const normalizedBrand = normalizeBrandKey(capitalizeText(brand));

  if (!normalizedName) {
    return null;
  }

  const { data, error } = await supabase
    .from('products')
    .select('id,name,category_id,brand_id,image_url');

  if (error) throw error;

  return (data || []).find((product: any) => {
    if (excludeId && product.id === excludeId) return false;
    return normalizeProductKey(product.name) === normalizedName
      && normalizeProductKey(product.category_id) === normalizedCategory
      && normalizeBrandKey(product.brand_id) === normalizedBrand;
  }) || null;
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

async function robustUpdate(table: string, dbRow: any, eqKey: string, eqVal: any, excludedColumns: string[] = []): Promise<{ data: any, error: any }> {
  const rowToUpdate = { ...dbRow };
  excludedColumns.forEach(col => delete rowToUpdate[col]);

  try {
    const { data, error } = await supabase.from(table).update(rowToUpdate).eq(eqKey, eqVal).select();
    
    if (error && error.code === 'PGRST204') {
      const match = error.message.match(/find the '([^']+)' column/);
      if (match && match[1]) {
        const missingColumn = match[1];
        console.warn(`robustUpdate: Column '${missingColumn}' not found in table '${table}'. Retrying without it.`);
        return robustUpdate(table, dbRow, eqKey, eqVal, [...excludedColumns, missingColumn]);
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
        await transporter.sendMail({
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

      const token = jwt.sign({ userId: data.id, email: data.email }, JWT_SECRET, { expiresIn: "1h" });
      res.json({ token, user: { id: data.id, email: data.email, name: data.name } });
    } catch (error: any) {
      console.error("Supabase login failed:", error);
      sendDatabaseError(res, error);
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
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Apex Distro ERP" <noreply@erp.com>',
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
      const { data, error } = await supabase.from('products').select('*');
      if (error) return sendDatabaseError(res, error);
      const mapped = (data || []).map(mapProduct);
      res.json(mapped);
    } catch (error: any) {
      console.error("Supabase products fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });
  
  app.post("/api/products", async (req, res) => {
    console.log("POST /api/products body:", req.body);
    const { id, name, sku, category, brand, stock, price, barcode, imageUrl, lowInventoryThreshold } = req.body;
    
    const capName = name ? capitalizeText(name) : '';
    const capCategory = category ? capitalizeText(category) : '';
    const capBrand = brand ? capitalizeText(brand) : '';
    try {
      const duplicate = await findDuplicateProduct(capName, capCategory, capBrand);
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
    
    const parsedSku = `${sku || ''}::${barcode || ''}::${lowInventoryThreshold !== undefined ? lowInventoryThreshold : ''}`;

    const dbRow = {
      id: id || randomUUID(),
      name: capName,
      sku: parsedSku,
      stock: stock || 0,
      price: price || 0,
      image_url: imageUrl || '',
      category_id: capCategory,
      brand_id: capBrand
    };

    const { data, error } = await robustInsert('products', dbRow);
    if (error) {
      console.error("Supabase insert product error - message:", error.message);
      console.error("Supabase insert product error - details:", error.details);
      console.error("Supabase insert product error - hint:", error.hint);
      console.error("Supabase insert product error - code:", error.code);
      return sendDatabaseError(res, error);
    }
    
    const p = (data && data.length > 0) ? data[0] : dbRow;
    const mapped = mapProduct(p);
    console.log("Supabase insert product success:", mapped);
    res.json(mapped);
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { name, sku, category, brand, stock, price, barcode, imageUrl, lowInventoryThreshold } = req.body;
      const { data: existingProduct } = await supabase.from('products').select('*').eq('id', req.params.id).single();
      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const capName = name !== undefined ? capitalizeText(name) : existingProduct.name;
      const capCategory = category !== undefined ? capitalizeText(category) : existingProduct.category_id;
      const capBrand = brand !== undefined ? capitalizeText(brand) : existingProduct.brand_id;
      const duplicate = await findDuplicateProduct(capName, capCategory, capBrand, req.params.id);
      if (duplicate) {
        await deleteCloudinaryImage(getCloudinaryPublicIdFromUrl(imageUrl));
        return res.status(409).json({
          error: 'Already existing product with the same name, category, and brand.'
        });
      }

      const parsedSku = `${sku || ''}::${barcode || ''}::${lowInventoryThreshold !== undefined ? lowInventoryThreshold : ''}`;

      const dbRow: any = {};
      if (name !== undefined) dbRow.name = capName;
      if (sku !== undefined || barcode !== undefined || lowInventoryThreshold !== undefined) {
        dbRow.sku = parsedSku;
      }
      if (stock !== undefined) dbRow.stock = stock;
      if (price !== undefined) dbRow.price = price;
      if (imageUrl !== undefined) dbRow.image_url = imageUrl;
      if (category !== undefined) dbRow.category_id = capCategory;
      if (brand !== undefined) dbRow.brand_id = capBrand;

      const { data, error } = await robustUpdate('products', dbRow, 'id', req.params.id);
      if (error) return sendDatabaseError(res, error);
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
      const { data: product } = await supabase.from('products').select('image_url').eq('id', req.params.id).single();
      const { error } = await supabase.from('products').delete().eq('id', req.params.id);
      if (error) return sendDatabaseError(res, error);
      await deleteCloudinaryImage(getCloudinaryPublicIdFromUrl(product?.image_url));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase product delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const { data, error } = await supabase.from('sales').select('*');
      if (error) return sendDatabaseError(res, error);
      
      const mapped = (data || []).map((s: any) => {
        const creditMatch = (s.seller_name || '').match(/\[CREDIT:([\d.]+)\]/);
        const decodedCredit = creditMatch ? parseFloat(creditMatch[1]) : 0;
        const cleanSellerName = s.seller_name ? s.seller_name.replace(/\s*\[CREDIT:[\d.]+\s*\]/, '') : 'Admin';

        return {
          id: s.id,
          total: s.total,
          date: s.date,
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
        const { data: product } = await supabase.from('products').select('stock').eq('id', item.productId).single();
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          if (product.stock < item.quantity) {
            return res.status(400).json({ error: `Insufficient stock for product ${item.name || item.productId}. Available: ${product.stock}, Requested: ${item.quantity}` });
          }
          await supabase.from('products').update({ stock: newStock }).eq('id', item.productId);
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

      const newSale = {
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
      };

      // 2. Insert Sale
      const { data: saleData, error: saleError } = await robustInsert('sales', newSale);
      if (saleError) return sendDatabaseError(res, saleError);

      // 3. Update customer
      if (customerId) {
        const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).single();
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
            }).eq('id', customerId);
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
      const { data: sale } = await supabase.from('sales').select('*').eq('id', req.params.id).single();
      if (!sale) return res.status(404).json({ error: 'Not found' });

      // Restock
      if (sale.items) {
        for (const item of sale.items) {
           const { data: product } = await supabase.from('products').select('stock').eq('id', item.productId).single();
           if (product) {
             await supabase.from('products').update({ stock: product.stock + item.quantity }).eq('id', item.productId);
           }
        }
      }
      
      // Update customer stats
      const custId = sale.customer_id;
      if (custId) {
        const { data: customer } = await supabase.from('customers').select('*').eq('id', custId).single();
        if (customer) {
            await supabase.from('customers').update({
                total_amount: Math.max(0, (customer.total_amount || 0) - sale.total),
                paid_amount: Math.max(0, (customer.paid_amount || 0) - (sale.amount_paid || sale.total)),
                payments: (customer.payments || []).filter((p: any) => !p.notes?.includes(sale.id))
            }).eq('id', custId);
        }
      }

      const { error } = await supabase.from('sales').delete().eq('id', req.params.id);
      if (error) return sendDatabaseError(res, error);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase sale delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) return sendDatabaseError(res, error);
      res.json(data);
    } catch (error: any) {
      console.error("Supabase categories fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const capitalizedData = {
        ...req.body,
        name: req.body.name ? capitalizeText(req.body.name) : undefined,
      };
      const { data, error } = await supabase.from('categories').insert([{ ...capitalizedData, id: randomUUID() }]).select();
      if (error) return sendDatabaseError(res, error);
      res.json(data[0]);
    } catch (error: any) {
      console.error("Supabase category create failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
      if (error) return sendDatabaseError(res, error);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase category delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.get("/api/brands", async (req, res) => {
    try {
      const { data, error } = await supabase.from('brands').select('*');
      if (error) return sendDatabaseError(res, error);
      res.json(data);
    } catch (error: any) {
      console.error("Supabase brands fetch failed:", error);
      res.status(500).json({ error: formatDatabaseError(error) });
    }
  });

  app.post("/api/brands", async (req, res) => {
    try {
      const capitalizedData = {
        ...req.body,
        name: req.body.name ? capitalizeText(req.body.name) : undefined,
      };
      const { data, error } = await supabase.from('brands').insert([{ ...capitalizedData, id: randomUUID() }]).select();
      if (error) return sendDatabaseError(res, error);
      res.json(data[0]);
    } catch (error: any) {
      console.error("Supabase brand create failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.delete("/api/brands/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('brands').delete().eq('id', req.params.id);
      if (error) return sendDatabaseError(res, error);
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
      const { data, error } = await supabase.from('settings').select('*').single();
      if (error) {
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
      const { data: existingSettings } = await supabase.from('settings').select('*').single();
      const oldPublicId = existingSettings?.profilePicturePublicId
        || existingSettings?.profile_picture_public_id
        || getCloudinaryPublicIdFromUrl(existingSettings?.profilePictureUrl || existingSettings?.profile_picture_url);
      const nextPublicId = req.body.profilePicturePublicId
        || req.body.profile_picture_public_id
        || getCloudinaryPublicIdFromUrl(req.body.profilePictureUrl || req.body.profile_picture_url);

      const { data, error } = await robustUpsert('settings', mapSettingsToDb(req.body));
      if (error) return sendDatabaseError(res, error);
      if (oldPublicId && oldPublicId !== nextPublicId) {
        await deleteCloudinaryImage(oldPublicId);
      }
      res.json(mapSettings(data[0]));
    } catch (error: any) {
      console.error("Supabase settings update failed:", error);
      sendDatabaseError(res, error);
    }
  });

  // Customer APIs
  app.get("/api/customers", async (req, res) => {
    try {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) return res.status(500).json({ error: error.message });
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

      const dbRow = {
        id: req.body.id || randomUUID(),
        name: capName,
        phone: phone || '',
        email: email || '',
        address: capAddress,
        total_amount: totalAmount || 0,
        paid_amount: paidAmount || 0,
        payments: payments || []
      };

      const { data, error } = await robustInsert('customers', dbRow);
      if (error) {
        console.error("Supabase insert customer error - message:", error.message);
        console.error("Supabase insert customer error - details:", error.details);
        console.error("Supabase insert customer error - code:", error.code);
        return sendDatabaseError(res, error);
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

      const { data, error } = await robustUpdate('customers', dbRow, 'id', req.params.id);
      if (error) return sendDatabaseError(res, error);
      
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
      const { error } = await supabase.from('customers').delete().eq('id', req.params.id);
      if (error) return sendDatabaseError(res, error);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase customer delete failed:", error);
      sendDatabaseError(res, error);
    }
  });

  app.post("/api/customers/:id/payments", async (req, res) => {
    try {
      const { data: customer, error: fetchError } = await supabase.from('customers').select('*').eq('id', req.params.id).single();
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

      const { data, error: updateError } = await robustUpdate('customers', updatePayload, 'id', req.params.id);

      if (updateError) return sendDatabaseError(res, updateError);
      
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
      const { data: dbProducts } = await supabase.from('products').select('*');
      const { data: dbSales } = await supabase.from('sales').select('*');
      const { data: dbCustomers } = await supabase.from('customers').select('*');
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
    const { data: dbProducts } = await supabase.from('products').select('*');
    const { data: dbSales } = await supabase.from('sales').select('*');
    const { data: dbCustomers } = await supabase.from('customers').select('*');

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

    const mappedCustomers = (dbCustomers || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      totalAmount: c.total_amount || 0,
      paidAmount: c.paid_amount || 0,
      dueAmount: (c.total_amount || 0) - (c.paid_amount || 0),
      payments: c.payments || []
    }));

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
      return res.status(200).json({
        action: "error",
        product: null,
        target: null,
        quantity: 0,
        message_ur: e.message || "Groq assistant failed. Please check GROQ_API_KEY.",
        executed: false
      });
    }

    // Groq-only mode: local semantic fallback is intentionally disabled.
    if (false && (fallbackUsed || !parsed)) {
      const cleanPrompt = prompt.toLowerCase().trim();
      let matchedProduct = null;
      let action = "check_stock";
      let quantity = 1;
      let message_ur = "";

      const isGeneralTopSellerQuery = cleanPrompt.includes("seller") || cleanPrompt.includes("selling") || cleanPrompt.includes("zyada bika") || cleanPrompt.includes("زیادہ") || cleanPrompt.includes("bika") || cleanPrompt.includes("faroxt");
      const isLowStockQuery = cleanPrompt.includes("kam stock") || cleanPrompt.includes("low stock") || cleanPrompt.includes("alerts") || cleanPrompt.includes("khali");

      if (isGeneralTopSellerQuery) {
        // Calculate top selling product in the local state
        const localStats: Record<string, number> = {};
        mappedSales.forEach(sale => {
          if (sale.items) {
            sale.items.forEach(item => {
              localStats[item.name] = (localStats[item.name] || 0) + item.quantity;
            });
          }
        });
        
        let topName = "";
        let topQty = 0;
        Object.entries(localStats).forEach(([name, qty]) => {
          if (qty > topQty) {
            topQty = qty;
            topName = name;
          }
        });

        if (!topName) {
          // If no recorded sale, return our default star product with placeholder
          topName = "Tomato Ketchup 5L";
          topQty = 120;
        }

        parsed = {
          action: "general_query",
          product: null,
          quantity: 0,
          message_ur: `اس وقت سب سے زیادہ بکنے والا پروڈکٹ ${topName} ہے جس کے کل ${topQty} یونٹس فروخت ہوئے ہیں۔`
        };
      } else if (isLowStockQuery) {
        const lows = mappedProducts.filter(p => p.stock < 15);
        const names = lows.map(p => p.name).join(", ");
        parsed = {
          action: "general_query",
          product: null,
          quantity: 0,
          message_ur: lows.length > 0 
            ? `اس وقت ${lows.length} آئٹمز کم اسٹاک میں ہیں، جن میں ${names} شامل ہیں۔`
            : `سب خیریت ہے، اس وقت تمام پروڈکٹس کا اسٹاک بہترین سطح پر ہے۔`
        };
      } else {
        // 1. Identify matched product based on keywords
        if (cleanPrompt.includes("ketchup") || cleanPrompt.includes("kechap") || cleanPrompt.includes("کیچپ") || cleanPrompt.includes("ٹماٹر")) {
          matchedProduct = mappedProducts.find(p => p.name.toLowerCase().includes("ketchup")) || mappedProducts[0];
        } else if (cleanPrompt.includes("mayo") || cleanPrompt.includes("mayonnaise") || cleanPrompt.includes("مایونیز") || cleanPrompt.includes("میو")) {
          matchedProduct = mappedProducts.find(p => p.name.toLowerCase().includes("mayonnaise")) || mappedProducts[1];
        } else if (cleanPrompt.includes("oil") || cleanPrompt.includes("cooking") || cleanPrompt.includes("تیل") || cleanPrompt.includes("آئل") || cleanPrompt.includes("tel")) {
          matchedProduct = mappedProducts.find(p => p.name.toLowerCase().includes("oil")) || mappedProducts[2];
        } else {
          // Broad substring match with database names
          matchedProduct = mappedProducts.find(p => {
            const dbName = p.name.toLowerCase();
            return cleanPrompt.includes(dbName) || dbName.includes(cleanPrompt);
          });
        }

        // 2. Identify the intent Action
        if (cleanPrompt.includes("add") || cleanPrompt.includes("shamil") || cleanPrompt.includes("شامل") || cleanPrompt.includes("جمع") || cleanPrompt.includes("daal") || cleanPrompt.includes("ڈال") || cleanPrompt.includes("plus")) {
          action = "add_stock";
        } else if (cleanPrompt.includes("remove") || cleanPrompt.includes("nikal") || cleanPrompt.includes("kam") || cleanPrompt.includes("کم") || cleanPrompt.includes("منہا") || cleanPrompt.includes("minus")) {
          action = "remove_stock";
        } else if (cleanPrompt.includes("update") || cleanPrompt.includes("set") || cleanPrompt.includes("رکھیں") || cleanPrompt.includes("بدلیں")) {
          action = "update_stock";
        } else if (cleanPrompt.includes("check") || cleanPrompt.includes("kitna") || cleanPrompt.includes("کتنا") || cleanPrompt.includes("btao") || cleanPrompt.includes("دیکھیں") || cleanPrompt.includes("معلوم")) {
          action = "check_stock";
        }

        // 3. Extract quantity digit format
        const digitMatch = cleanPrompt.match(/\d+/);
        if (digitMatch) {
          quantity = parseInt(digitMatch[0], 10);
        }

        if (!matchedProduct) {
          parsed = {
            action: "error",
            product: null,
            quantity: 0,
            message_ur: "یہ پروڈکٹ ہماری انوینٹری میں موجود نہیں ہے"
          };
        } else {
          const prodName = matchedProduct.name;
          if (action === "add_stock") {
            message_ur = `میں نے ${quantity} ${prodName} اسٹاک میں شامل کر دیئے ہیں۔`;
          } else if (action === "remove_stock") {
            message_ur = `میں نے ${quantity} ${prodName} کی سیل درج کر کے اسٹاک سے نکال دیئے ہیں۔`;
          } else if (action === "update_stock") {
            message_ur = `میں نے ${prodName} کا نیا اسٹاک ${quantity} یونٹس سیٹ کر دیا ہے۔`;
          } else {
            // check stock
            const currentStock = matchedProduct.stock;
            message_ur = `اس وقت ${prodName} کا موجودہ اسٹاک ${currentStock} یونٹس ہے۔`;
          }

          parsed = {
            action,
            product: prodName,
            quantity,
            message_ur
          };
        }
      }
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
        const { data: freshCust } = await supabase.from('customers').select('*').eq('id', matchCustomer.id).single();
        const currentPaidAmount = freshCust?.paid_amount || matchCustomer.paidAmount || 0;
        const newPaidAmount = currentPaidAmount + quantityNum;
        const aiSellerLabel = sellerName ? `AI Voice Assistant on behalf of ${sellerName}` : 'AI Voice Assistant';
        
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
        }).eq('id', matchCustomer.id);
        
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
        const { data: freshCust } = await supabase.from('customers').select('*').eq('id', matchCustomer.id).single();
        const currentTotalAmount = freshCust?.total_amount || matchCustomer.totalAmount || 0;
        const newTotalAmount = currentTotalAmount + quantityNum;
        
        const saleId = `ORD-${Date.now().toString().slice(-4)}`;
        const saleDate = new Date().toISOString();
        const aiSellerLabel = sellerName ? `AI Voice Assistant on behalf of ${sellerName}` : 'AI Voice Assistant';
        
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
        }).eq('id', matchCustomer.id);
        
        // Create a formal Sale record for tracking in Sales page
        const newSale = {
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
        };
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

      // 1. Case-insensitive Substring Mapping
      if (!matchProduct && proposedProduct) {
        const cleanProposed = proposedProduct.toLowerCase().trim();
        matchProduct = mappedProducts.find(p => {
          const dbName = p.name.toLowerCase();
          return dbName.includes(cleanProposed) || cleanProposed.includes(dbName);
        });
      }

      // 2. Keyword fallback map for common Roman / Urdu / English transcriptions
      if (!matchProduct && proposedProduct) {
        const pLower = proposedProduct.toLowerCase();
        if (pLower.includes("ketchup") || pLower.includes("kechap") || pLower.includes("کیچپ") || pLower.includes("ٹماٹر")) {
          matchProduct = mappedProducts.find(p => p.name.toLowerCase().includes("ketchup"));
        } else if (pLower.includes("mayo") || pLower.includes("mayonnaise") || pLower.includes("مایونیز") || pLower.includes("میو")) {
          matchProduct = mappedProducts.find(p => p.name.toLowerCase().includes("mayonnaise"));
        } else if (pLower.includes("oil") || pLower.includes("cooking") || pLower.includes("تیل") || pLower.includes("آئل")) {
          matchProduct = mappedProducts.find(p => p.name.toLowerCase().includes("oil"));
        }
      }

      // 3. Raw prompt backup scanner: in case the AI didn't successfully map the product but it's present in user prompt
      if (!matchProduct && prompt) {
        const rawPrompt = prompt.toLowerCase();
        if (rawPrompt.includes("ketchup") || rawPrompt.includes("kechap") || rawPrompt.includes("کیچپ") || rawPrompt.includes("ٹماٹر")) {
          matchProduct = mappedProducts.find(p => p.name.toLowerCase().includes("ketchup"));
        } else if (rawPrompt.includes("mayo") || rawPrompt.includes("mayonnaise") || rawPrompt.includes("مایونیز") || rawPrompt.includes("میو")) {
          matchProduct = mappedProducts.find(p => p.name.toLowerCase().includes("mayonnaise"));
        } else if (rawPrompt.includes("oil") || rawPrompt.includes("cooking") || rawPrompt.includes("تیل") || rawPrompt.includes("آئل")) {
          matchProduct = mappedProducts.find(p => p.name.toLowerCase().includes("oil"));
        }
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
        await supabase.from('products').update({ stock: finalNewStock }).eq('id', matchProduct.id);
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
        await supabase.from('products').update({ stock: finalNewStock }).eq('id', matchProduct.id);
        
        if (proposedAction === "make_sale") {
          const matchCustomer = findBestEntity(mappedCustomers, prompt, proposedTarget);
          const totalValue = quantityNum * matchProduct.price;
          const saleId = `ORD-${Date.now().toString().slice(-4)}`;
          const saleDate = new Date().toISOString();
          const aiSellerLabel = sellerName ? `AI Voice Assistant on behalf of ${sellerName}` : 'AI Voice Assistant';
          
          let amountPaid = totalValue;
          
          if (matchCustomer) {
            // For a regular customer, we assume it's on credit (0 paid) by default
            amountPaid = 0;
            
            // Fetch fresh customer data from DB to avoid stale cache
            const { data: freshCust } = await supabase.from('customers').select('*').eq('id', matchCustomer.id).single();
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
            }).eq('id', matchCustomer.id);
          }

          const newSale = {
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
          };
          const { error: saleError } = await robustInsert('sales', newSale);
          if (saleError) console.error("make_sale sales insert error:", saleError);
        }
        
        executed = true;
      } else if (proposedAction === "update_stock") {
        finalNewStock = quantityNum;
        await supabase.from('products').update({ stock: finalNewStock }).eq('id', matchProduct.id);
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
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  }
