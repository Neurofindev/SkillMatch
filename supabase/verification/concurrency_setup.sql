do $$
begin
  insert into public.missions (
    id, owner_id, title, description, category, work_mode,
    budget_model, budget_min, budget_max, status
  )
  values (
    'f1000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'Démonstration — course concurrente',
    'Fixture locale dédiée à deux acceptations concurrentes de candidatures présélectionnées.',
    'Numérique',
    'remote',
    'fixed',
    100,
    200,
    'selecting'
  );

  insert into public.applications (
    id, mission_id, applicant_id, message, availability_note, status
  )
  values
    (
      'f2000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000002',
      'Première candidature de démonstration pour le test de concurrence réel.',
      'Disponible immédiatement pour la vérification concurrente.',
      'shortlisted'
    ),
    (
      'f2000000-0000-0000-0000-000000000002',
      'f1000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000003',
      'Deuxième candidature de démonstration pour le test de concurrence réel.',
      'Disponible immédiatement pour la vérification concurrente.',
      'shortlisted'
    );
end;
$$;
