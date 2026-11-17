import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type PushSubscriptionRow = {
  id: string
  couple_id: string
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  timezone: string
  reminder_time: string
  last_reminded_on: string | null
}

const cronSecret = Deno.env.get('CRON_SECRET')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@fazahub.app'

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return Response.json({ error: 'Reminder service is not configured.' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id,couple_id,subscription,timezone,reminder_time,last_reminded_on')

  if (subscriptionsError) {
    console.error('Failed to load push subscriptions:', subscriptionsError.message)
    return Response.json({ error: 'Could not load push subscriptions.' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  const failures: string[] = []

  for (const row of subscriptions as PushSubscriptionRow[]) {
    try {
      const localTime = new Intl.DateTimeFormat('en-CA', {
        timeZone: row.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date())
      const parts = Object.fromEntries(localTime.map(part => [part.type, part.value]))
      const localDate = `${parts.year}-${parts.month}-${parts.day}`
      const [reminderHour] = row.reminder_time.split(':').map(Number)

      if (Number(parts.hour) !== reminderHour || Number(parts.minute) >= 5 || row.last_reminded_on === localDate) {
        skipped += 1
        continue
      }

      const { data: snaps, error: snapsError } = await supabase
        .from('daily_snaps')
        .select('id')
        .eq('couple_id', row.couple_id)
        .eq('snap_date', localDate)
        .limit(1)
      if (snapsError) throw snapsError
      if (snaps?.length) {
        skipped += 1
        continue
      }

      await webpush.sendNotification(row.subscription, JSON.stringify({
        title: 'Satu momen kecil hari ini?',
        body: 'Simpan cerita kalian sebelum hari ini berlalu 🤍',
        url: '/',
        tag: `fazahub-reminder-${localDate}`
      }))

      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({ last_reminded_on: localDate, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (updateError) throw updateError
      sent += 1
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await supabase.from('push_subscriptions').delete().eq('id', row.id)
        if (deleteError) console.error('Failed to remove expired push subscription:', deleteError.message)
      }
      const message = error instanceof Error ? error.message : 'Unknown notification error.'
      console.error(`Reminder failed for subscription ${row.id}:`, message)
      failures.push(row.id)
    }
  }

  return Response.json({ sent, skipped, failures })
})
