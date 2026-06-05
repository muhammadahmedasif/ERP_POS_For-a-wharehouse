import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false }).limit(10);
  if (error) {
    console.error("Fetch error:", error);
  } else {
    console.log("Recent 10 sales:");
    data.forEach(s => {
      console.log(`- ID: ${s.id}, Date: ${s.date}, Total: ${s.total}, Seller: ${s.seller_name}`);
    });
  }
}

run();
