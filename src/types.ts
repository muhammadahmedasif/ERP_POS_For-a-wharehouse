export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  stock: number;
  price: number;
  barcode?: string;
  imageUrl?: string;
  publicId?: string;
  lowInventoryThreshold?: number;
  unitType?: string;
  lastRestock?: string;
  lastRestockAmount?: number;
  lastLowStockDate?: string;
  lastLowStockAmount?: number;
};

export type CustomerPayment = {
  id: string;
  amount: number;
  date: string;
  notes?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalAmount: number;
  paidAmount: number;
  payments?: CustomerPayment[];
};

export type SaleItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  returnedQuantity?: number;
};

export type Sale = {
  id: string;
  total: number;
  date: string;
  items: SaleItem[];
  customerId?: string | null;
  amountPaid?: number;
  discountAmount?: number;
  discountType?: string;
  discountValue?: string;
  sellerName?: string;
  returnedItems?: { productId: string; name: string; quantity: number; price: number }[];
  returnAmount?: number;
  returnDate?: string;
};
