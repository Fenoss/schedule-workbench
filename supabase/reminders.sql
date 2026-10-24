-- Weekly "updates due" reminder emails: a pg_cron job calls the update-reminders function every Monday.
-- The key that authorises the call is generated inside the database and never leaves it.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'reminder_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'reminder_key');
  end if;
end $$;
create or replace function public.check_reminder_key(k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'reminder_key' and decrypted_secret = k)
$$;
revoke execute on function public.check_reminder_key(text) from public, anon, authenticated;
grant execute on function public.check_reminder_key(text) to service_role;
-- Replace <project-ref> with your project's reference (the part before .supabase.co), then run.
select cron.schedule('workbench-update-reminders', '7 14 * * 1',
  $job$ select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/update-reminders',
    headers := jsonb_build_object('content-type', 'application/json', 'x-reminder-key', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_key')),
    body := '{}'::jsonb) $job$);
