drop policy if exists "workspace editors can upload workspace global asset objects"
on storage.objects;

update public.job_runs
set input_json = jsonb_set(coalesce(input_json, '{}'::jsonb), '{schema_version}', '1'::jsonb, true)
where input_json->>'schema_version' is null;

update public.job_runs
set output_json = jsonb_set(output_json, '{schema_version}', '1'::jsonb, true)
where output_json is not null
  and output_json->>'schema_version' is null;

update public.job_runs
set error_json = jsonb_set(error_json, '{schema_version}', '1'::jsonb, true)
where error_json is not null
  and error_json->>'schema_version' is null;

alter table public.job_runs
  alter column input_json set default '{"schema_version":1}'::jsonb,
  add constraint job_runs_input_json_schema_version_check check ((input_json->>'schema_version') is not null),
  add constraint job_runs_output_json_schema_version_check check (output_json is null or (output_json->>'schema_version') is not null),
  add constraint job_runs_error_json_schema_version_check check (error_json is null or (error_json->>'schema_version') is not null);

update public.automation_logs
set context_json = jsonb_set(coalesce(context_json, '{}'::jsonb), '{schema_version}', '1'::jsonb, true)
where context_json->>'schema_version' is null;

alter table public.automation_logs
  alter column context_json set default '{"schema_version":1}'::jsonb,
  add constraint automation_logs_context_json_schema_version_check check ((context_json->>'schema_version') is not null);
