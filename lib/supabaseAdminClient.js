import { createClient } from "@supabase/supabase-js";

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PRIVATE_SUPABASE_SERVICE_ROLE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_SERVICE_ROLE_KEY
);
