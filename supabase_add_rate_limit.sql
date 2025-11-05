
-- supabase_add_rate_limit.sql
create or replace function check_rate_limit(
  input_user_id uuid,
  input_endpoint text default 'default'
) returns boolean
language plpgsql
security definer
as $$
declare
  window_start timestamptz := date_trunc('minute', now());
  current_tokens int;
begin
  insert into rate_limit_counters(user_id, endpoint, window_start, tokens)
  values (input_user_id, input_endpoint, window_start, 0)
  on conflict (user_id, endpoint, window_start) do nothing;

  update rate_limit_counters
     set tokens = tokens + 1
   where user_id = input_user_id and endpoint = input_endpoint and window_start = window_start
  returning tokens into current_tokens;

  return current_tokens > 60; -- limit: 60 req/min
end $$;

grant execute on function check_rate_limit(uuid, text) to anon;
