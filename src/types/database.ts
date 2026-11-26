export type ShipmentStatus = 'pending' | 'shipped';

export type Shop = {
  id: string; // uuid, = auth.users.id
  email: string;
  shop_name: string;
  whatsapp_phone: string; // digits only, e.g. "9665XXXXXXXX"
  subscription_active: boolean; // READ-ONLY for the shop (admin sets it)
  paid_until: string | null; // ISO timestamp, READ-ONLY
};

export type Shipment = {
  id: string; // uuid
  shop_id: string; // uuid, defaults to auth.uid()
  customer_name: string;
  customer_phone: string; // digits only, intl format
  customer_address: string;
  tracking_number: string | null; // READ-ONLY for the shop (admin sets it)
  status: ShipmentStatus; // READ-ONLY for the shop (admin sets it)
  created_at: string; // ISO timestamp
};

// What the shop may send
export type ShipmentInsert = Pick<
  Shipment,
  'customer_name' | 'customer_phone' | 'customer_address'
>; // shop_id is filled by the DB (default auth.uid())

export type ShipmentUpdate = Partial<ShipmentInsert>; // only while status = 'pending'
export type ShopUpdate = Partial<Pick<Shop, 'shop_name' | 'whatsapp_phone'>>;

export type Database = {
  public: {
    Tables: {
      shops: {
        Row: Shop;
        Insert: never; // created by DB trigger on signup
        Update: ShopUpdate;
        Relationships: [];
      };
      shipments: {
        Row: Shipment;
        Insert: ShipmentInsert;
        Update: ShipmentUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ---- helpers ----

// wa.me needs digits only: no "+", spaces, or leading "00"/"0".
// Handles: 05XXXXXXXX, 5XXXXXXXX, +966 5XXXXXXXX, 00966..., +966 (0)5XXXXXXXX
export function toWaDigits(raw: string, defaultCountry = '966'): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(defaultCountry + '0')) {
    d = defaultCountry + d.slice(defaultCountry.length + 1); // 9660... -> 966...
  } else if (d.startsWith('0')) {
    d = defaultCountry + d.slice(1); // 05XXXXXXXX -> 9665XXXXXXXX
  } else if (d.length === 9 && d.startsWith('5')) {
    d = defaultCountry + d; // 5XXXXXXXX -> 9665XXXXXXXX
  }
  return d;
}

// After toWaDigits(): 10-15 digits, no leading zero (E.164 range)
export function isValidWaNumber(digits: string): boolean {
  return /^[1-9][0-9]{9,14}$/.test(digits);
}

export function trackingWhatsAppLink(s: Shipment, shopName: string): string {
  const text = `Hello ${s.customer_name}, your order from ${shopName} has shipped. Tracking number: ${s.tracking_number}`;
  return `https://wa.me/${toWaDigits(s.customer_phone)}?text=${encodeURIComponent(text)}`;
}
