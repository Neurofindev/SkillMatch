do $$
declare
  rejected boolean;
begin
  begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    ('90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'smoke-client@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
    ('90000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'smoke-talent@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now()),
    ('90000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'smoke-other@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now());

  insert into public.profiles (
    id, username, display_name, primary_mode, can_work, can_hire,
    adult_confirmed, onboarding_completed
  )
  values
    ('90000000-0000-0000-0000-000000000001', 'smoke-client', 'Smoke Client', 'client', false, true, true, true),
    ('90000000-0000-0000-0000-000000000002', 'smoke-talent', 'Smoke Talent', 'talent', true, false, true, true),
    ('90000000-0000-0000-0000-000000000003', 'smoke-other', 'Smoke Other', 'talent', true, false, true, true);

  insert into public.missions (
    id, owner_id, title, description, category, work_mode,
    budget_model, budget_min, budget_max, status
  )
  values (
    '91000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    'Mission smoke test',
    'Description suffisamment longue pour le contrôle SQL direct.',
    'Développement',
    'remote',
    'fixed',
    100,
    200,
    'published'
  );

  rejected := false;
  begin
    update public.missions
    set status = 'invalid'
    where id = '91000000-0000-0000-0000-000000000001';
  exception when invalid_text_representation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'invalid enum state was accepted';
  end if;

  rejected := false;
  begin
    update public.missions
    set budget_min = 300, budget_max = 200
    where id = '91000000-0000-0000-0000-000000000001';
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'invalid budget range was accepted';
  end if;

  insert into public.applications (
    id, mission_id, applicant_id, message, availability_note
  )
  values (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000002',
    'Candidature valide pour le contrôle SQL direct.',
    'Disponible immédiatement'
  );

  rejected := false;
  begin
    insert into public.applications (
      mission_id, applicant_id, message, availability_note
    )
    values (
      '91000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002',
      'Seconde candidature active qui doit être refusée.',
      'Disponible immédiatement'
    );
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'duplicate active application was accepted';
  end if;

  update public.applications set status = 'viewed'
  where id = '92000000-0000-0000-0000-000000000001';
  update public.applications set status = 'shortlisted'
  where id = '92000000-0000-0000-0000-000000000001';
  update public.applications set status = 'accepted'
  where id = '92000000-0000-0000-0000-000000000001';

  insert into public.applications (
    id, mission_id, applicant_id, message, availability_note
  )
  values (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000003',
    'Autre candidature valide pour le contrôle de concurrence.',
    'Disponible prochainement'
  );
  update public.applications set status = 'viewed'
  where id = '92000000-0000-0000-0000-000000000002';
  update public.applications set status = 'shortlisted'
  where id = '92000000-0000-0000-0000-000000000002';
  update public.applications set status = 'accepted'
  where id = '92000000-0000-0000-0000-000000000002';

  insert into public.matches (
    id, mission_id, accepted_application_id, client_id, talent_id
  )
  values (
    '93000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000002'
  );

  rejected := false;
  begin
    insert into public.matches (
      mission_id, accepted_application_id, client_id, talent_id
    )
    values (
      '91000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000002',
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000003'
    );
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'duplicate active match was accepted';
  end if;

  update public.missions
  set status = 'assigned', assigned_talent_id = '90000000-0000-0000-0000-000000000002'
  where id = '91000000-0000-0000-0000-000000000001';
  perform set_config('skillmatch.phase07_action', 'start', true);
  update public.missions set status = 'in_progress'
  where id = '91000000-0000-0000-0000-000000000001';
  perform set_config('skillmatch.phase07_action', 'complete', true);
  update public.missions set status = 'completed'
  where id = '91000000-0000-0000-0000-000000000001';
  perform set_config('skillmatch.phase07_action', '', true);
  update public.matches set status = 'completed', completed_at = now()
  where id = '93000000-0000-0000-0000-000000000001';

  rejected := false;
  begin
    insert into public.reviews (
      match_id, mission_id, author_id, recipient_id, rating
    )
    values (
      '93000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002',
      6
    );
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'invalid review rating was accepted';
  end if;

  rejected := false;
  begin
    insert into public.reviews (
      match_id, mission_id, author_id, recipient_id, rating
    )
    values (
      '93000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000099',
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002',
      5
    );
  exception when foreign_key_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'incoherent review references were accepted';
  end if;

    raise exception 'rollback successful smoke fixture' using errcode = 'SM007';
  exception when sqlstate 'SM007' then
    raise notice 'SkillMatch constraint smoke tests passed';
  end;
end;
$$;
