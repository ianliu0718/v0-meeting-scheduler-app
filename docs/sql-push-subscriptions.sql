-- push_subscriptions 表與 RLS Policy (多租戶隔離) ---------------------------------
-- 若採用共用資料庫：請確保 JWT 內含 app_metadata.tenant_id
-- 將下列語句整合到你的 migration 系統中。

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  event_id text not null,
  participant_id uuid,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "tenant isolation - push_subscriptions"
on public.push_subscriptions
for all
using (tenant_id = (auth.jwt() ->> 'app_metadata' ->> 'tenant_id'))
with check (tenant_id = (auth.jwt() ->> 'app_metadata' ->> 'tenant_id'));

-- 建議索引：event_id + tenant_id 加速查詢
create index if not exists idx_push_subscriptions_event_tenant on public.push_subscriptions(event_id, tenant_id);
