import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  agent_slug: text('agent_slug').notNull(),
  template_vars: text('template_vars').notNull().default('{}'), // JSON
  voip_base_url: text('voip_base_url').notNull(),
  status: text('status').notNull().default('draft'), // draft|active|paused|completed
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  campaign_id: text('campaign_id').notNull().references(() => campaigns.id),
  phone: text('phone').notNull(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  extra_vars: text('extra_vars').notNull().default('{}'), // JSON
  status: text('status').notNull().default('pending'), // pending|calling|completed|failed|do_not_call
  call_uuid: text('call_uuid'),
  created_at: text('created_at').notNull(),
})

export const calls = sqliteTable('calls', {
  id: text('id').primaryKey(),
  campaign_id: text('campaign_id').notNull(),
  contact_id: text('contact_id').notNull(),
  call_uuid: text('call_uuid'),
  destination: text('destination'),
  status: text('status'),
  started_at: text('started_at'),
  ended_at: text('ended_at'),
  duration_seconds: integer('duration_seconds'),
  turn_count: integer('turn_count'),
  end_reason: text('end_reason'),
  transcript: text('transcript'), // JSON
  raw_cdr: text('raw_cdr'), // JSON
  created_at: text('created_at').notNull(),
})
