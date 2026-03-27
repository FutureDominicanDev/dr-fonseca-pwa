import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pdebkexayomjaougrlhr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZWJrZXhheW9tamFvdWdybGhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTU0MTMsImV4cCI6MjA4NDAzMTQxM30.eCJ98ZX1pnl8fOyZk6IrviaKXHt4ZJXK2mXOtN__ITs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);