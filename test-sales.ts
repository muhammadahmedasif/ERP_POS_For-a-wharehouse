import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('sales').select('*').limit(1);
  if (error) {
    console.error("Fetch error:", error);
  } else {
    console.log("Sales row schema:", data[0]);
  }

  // Also let's try to insert a dummy sale exactly like the AI does
  const newSale = {
    id: `ORD-TEST`,
    total: 100,
    date: new Date().toISOString(),
    items: [
      {
        productId: "test",
        name: "test",
        quantity: 1,
        price: 100
      }
    ],
    customer_id: null,
    amount_paid: 100,
    seller_name: 'AI Voice Assistant'
  };
  
  const insertRes = await supabase.from('sales').insert([newSale]);
  console.log("Insert result:", insertRes.error || "Success");

  if (!insertRes.error) {
    await supabase.from('sales').delete().eq('id', 'ORD-TEST');
  }
}

run();
