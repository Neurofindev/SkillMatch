with identity as materialized (
  select set_config(
    'request.jwt.claim.sub',
    'd0000000-0000-0000-0000-000000000001',
    true
  )
), accepted as materialized (
  select result.*
  from identity
  cross join lateral public.accept_application(
    'f2000000-0000-0000-0000-000000000001',
    1,
    1
  ) result
)
select accepted.*, pg_sleep(2)
from accepted;
