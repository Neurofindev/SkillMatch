-- The skills catalog is production reference data, not demonstration content.
-- It must be available even when supabase/seed.sql is intentionally omitted.
insert into public.skills (slug, name, category, is_active)
values
  ('accessibilite-web', 'Accessibilité web', 'Numérique', true),
  ('developpement-react', 'Développement React', 'Numérique', true),
  ('redaction-francaise', 'Rédaction française', 'Communication', true),
  ('support-evenementiel', 'Support événementiel', 'Services', true)
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  is_active = true;
