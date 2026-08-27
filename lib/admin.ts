import { supabase } from './supabase';

export const ADMIN_EMAILS = [
  'alexisharant@gmail.com',
  // Ajouter celui de Cédric ici plus tard
];

export const isAdmin = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
};