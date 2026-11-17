-- Run after creating the two Vault secrets described in README.md.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fazahub-daily-reminders';

select cron.schedule(
  'fazahub-daily-reminders',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'fazahub_project_url'
      ) || '/functions/v1/send-daily-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'fazahub_cron_secret'
        )
      ),
      body := '{}'::jsonb
    );
  $$
);
