import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';

export const settings = pgTable(
  'settings',
  {
    id: smallint('id').primaryKey().default(1),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('settings_singleton', sql`${t.id} = 1`)],
);

export const loginAttempts = pgTable('login_attempts', {
  ip: text('ip').primaryKey(),
  count: integer('count').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
});
