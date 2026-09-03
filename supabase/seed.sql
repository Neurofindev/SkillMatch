-- SkillMatch local-only demonstration seed.
--
-- Supabase CLI applies this file during `supabase db reset`; it is not part of
-- the migration chain and must never be executed by a production deployment.
-- Every visible identity and mission is labelled “Démonstration”. Seeded e-mail
-- addresses are deliberately unconfirmed, so no verified identity is invented.

-- Local-only demonstration skills. Production skills are entered by users.
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

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'd0000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'client.demo@skillmatch.invalid',
    extensions.crypt('skillmatch-local-demo', extensions.gen_salt('bf')),
    null,
    '{"provider":"email","providers":["email"],"demonstration":true}'::jsonb,
    '{"demonstration":true}'::jsonb,
    now(),
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'talent.demo@skillmatch.invalid',
    extensions.crypt('skillmatch-local-demo', extensions.gen_salt('bf')),
    null,
    '{"provider":"email","providers":["email"],"demonstration":true}'::jsonb,
    '{"demonstration":true}'::jsonb,
    now(),
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'double-mode.demo@skillmatch.invalid',
    extensions.crypt('skillmatch-local-demo', extensions.gen_salt('bf')),
    null,
    '{"provider":"email","providers":["email"],"demonstration":true}'::jsonb,
    '{"demonstration":true}'::jsonb,
    now(),
    now()
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'moderation.demo@skillmatch.invalid',
    extensions.crypt('skillmatch-local-demo', extensions.gen_salt('bf')),
    null,
    '{"provider":"email","providers":["email"],"demonstration":true}'::jsonb,
    '{"demonstration":true}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (
  id,
  username,
  display_name,
  headline,
  bio,
  primary_mode,
  can_work,
  can_hire,
  city,
  country_code,
  adult_confirmed,
  onboarding_completed
)
values
  (
    'd0000000-0000-0000-0000-000000000001',
    'demo-client',
    'Démonstration — Camille Client',
    'Besoin local fictif',
    'Profil fictif réservé aux démonstrations locales et aux vérifications de sécurité.',
    'client',
    false,
    true,
    'Lyon',
    'FR',
    true,
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'demo-talent',
    'Démonstration — Tania Talent',
    'Développement web fictif',
    'Profil fictif de talent utilisé uniquement pour le parcours local de démonstration.',
    'talent',
    true,
    false,
    'Grenoble',
    'FR',
    true,
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'demo-double-mode',
    'Démonstration — Dominique Double mode',
    'Client et talent fictif',
    'Profil fictif illustrant le compte unique capable de publier et de chercher des missions.',
    'talent',
    true,
    true,
    'Bruxelles',
    'BE',
    true,
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'demo-moderation',
    'Démonstration — Morgan Modération',
    'Modération locale fictive',
    'Profil fictif réservé aux tests locaux des autorisations de modération.',
    'talent',
    true,
    true,
    'Nantes',
    'FR',
    true,
    true
  );

-- No remote avatar is fabricated: the UI falls back to initials for these
-- profiles, and avatar_path remains null.

insert into public.user_roles (user_id, role, granted_by)
values ('d0000000-0000-0000-0000-000000000004', 'moderator', null);

insert into public.profile_skills (profile_id, skill_id, declared_level, years_experience)
select 'd0000000-0000-0000-0000-000000000002', s.id, 'advanced', 4
from public.skills s
where s.slug in ('accessibilite-web', 'developpement-react');

insert into public.profile_skills (profile_id, skill_id, declared_level, years_experience)
select 'd0000000-0000-0000-0000-000000000003', s.id, 'intermediate', 2
from public.skills s
where s.slug = 'redaction-francaise';

insert into public.missions (
  id,
  owner_id,
  title,
  description,
  category,
  work_mode,
  public_city,
  public_region,
  country_code,
  presence_details,
  budget_model,
  budget_min,
  budget_max,
  status
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — accueil d’un événement local',
    'Mission fictive de démonstration pour organiser l’accueil des participants à un petit événement local.',
    'Services',
    'local',
    'Lyon',
    'Auvergne-Rhône-Alpes',
    'FR',
    null,
    'fixed',
    80,
    120,
    'published'
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'Démonstration — audit éditorial à distance',
    'Mission fictive de démonstration réalisée entièrement à distance, sans critère ni pénalité géographique.',
    'Communication',
    'remote',
    null,
    null,
    null,
    null,
    'fixed',
    150,
    250,
    'selecting'
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — amélioration hybride d’une interface',
    'Mission fictive terminée combinant travail à distance et atelier ponctuel dans une zone publique approximative.',
    'Numérique',
    'hybrid',
    'Lyon',
    'Auvergne-Rhône-Alpes',
    'FR',
    'Démonstration — un atelier ponctuel en présentiel, dates à convenir.',
    'fixed',
    300,
    450,
    'selecting'
  );

insert into public.mission_skills (mission_id, skill_id, required_level, importance)
select 'd1000000-0000-0000-0000-000000000001', s.id, 'beginner', 3
from public.skills s
where s.slug = 'support-evenementiel';

insert into public.mission_skills (mission_id, skill_id, required_level, importance)
select 'd1000000-0000-0000-0000-000000000002', s.id, 'intermediate', 4
from public.skills s
where s.slug = 'redaction-francaise';

insert into public.mission_skills (mission_id, skill_id, required_level, importance)
select 'd1000000-0000-0000-0000-000000000003', s.id, 'advanced', 5
from public.skills s
where s.slug in ('accessibilite-web', 'developpement-react');

insert into public.applications (
  id,
  mission_id,
  applicant_id,
  message,
  proposed_amount,
  availability_note,
  status
)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'Candidature de démonstration : je peux relire et structurer les contenus proposés.',
    180,
    'Disponible deux matinées cette semaine.',
    'submitted'
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000004',
    'Candidature de démonstration présélectionnée pour vérifier les différents états.',
    210,
    'Disponible à distance la semaine prochaine.',
    'shortlisted'
  ),
  (
    'd2000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000002',
    'Candidature de démonstration acceptée pour illustrer une collaboration réellement reliée.',
    400,
    'Disponible pour le travail à distance et l’atelier ponctuel.',
    'accepted'
  );

update public.missions
set status = 'assigned',
    assigned_talent_id = 'd0000000-0000-0000-0000-000000000002'
where id = 'd1000000-0000-0000-0000-000000000003';

insert into public.matches (
  id,
  mission_id,
  accepted_application_id,
  client_id,
  talent_id
)
values (
  'd3000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002'
);

insert into public.conversations (id, match_id, mission_id)
values (
  'd4000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003'
);

insert into public.conversation_members (conversation_id, profile_id)
values
  ('d4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002');

insert into public.messages (conversation_id, author_id, body)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration : bonjour, voici le contexte de l’atelier.'
  ),
  (
    'd4000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'Démonstration : merci, le périmètre est clair.'
  );

insert into public.completion_confirmations (
  match_id,
  mission_id,
  participant_id,
  decision,
  note
)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'confirmed',
    'Démonstration : livrables reçus.'
  ),
  (
    'd3000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000002',
    'confirmed',
    'Démonstration : mission terminée.'
  );

select set_config('skillmatch.phase07_action', 'start', true);
update public.missions
set status = 'in_progress'
where id = 'd1000000-0000-0000-0000-000000000003';
select set_config('skillmatch.phase07_action', '', true);

select set_config('skillmatch.phase07_action', 'complete', true);
update public.missions
set status = 'completed'
where id = 'd1000000-0000-0000-0000-000000000003';
select set_config('skillmatch.phase07_action', '', true);

update public.matches
set status = 'completed',
    completed_at = now()
where id = 'd3000000-0000-0000-0000-000000000001';

insert into public.agreements (
  id,
  match_id,
  mission_id,
  version,
  created_by,
  scope_snapshot,
  deliverables,
  budget_model,
  budget_min,
  budget_max,
  client_confirmed_at,
  talent_confirmed_at,
  status
)
values (
  'd5000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  1,
  'd0000000-0000-0000-0000-000000000001',
  'Démonstration : audit d’accessibilité et corrections convenues pour l’interface.',
  '[{"label":"Rapport de démonstration"},{"label":"Correctifs de démonstration"}]'::jsonb,
  'fixed',
  300,
  450,
  now(),
  now(),
  'completed'
);

insert into public.mission_events (
  mission_id,
  actor_id,
  event_type,
  old_values,
  new_values,
  metadata
)
values
  (
    'd1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'talent_assigned',
    '{"status":"selecting"}'::jsonb,
    '{"status":"assigned"}'::jsonb,
    '{"demonstration":true}'::jsonb
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'mission_completed',
    '{"status":"in_progress"}'::jsonb,
    '{"status":"completed"}'::jsonb,
    '{"demonstration":true}'::jsonb
  );

insert into public.reviews (
  match_id,
  mission_id,
  author_id,
  recipient_id,
  rating,
  comment,
  criteria
)
values (
  'd3000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  5,
  'Démonstration : collaboration claire et livrables conformes au périmètre fictif.',
  '{"demonstration":true}'::jsonb
);

insert into public.notifications (recipient_id, type, title, body, internal_path)
values (
  'd0000000-0000-0000-0000-000000000002',
  'review_received',
  'Démonstration — avis reçu',
  'Un avis fictif lié à la mission de démonstration a été ajouté.',
  '/profile'
);
