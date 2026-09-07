import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// These field names match the pinned Better Auth 1.7 schema, including two-factor lockout fields.
export const user = sqliteTable('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false), image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  role: text('role').notNull().default('learner'), twoFactorEnabled: integer('twoFactorEnabled', { mode: 'boolean' }).default(false),
});
export const session = sqliteTable('session', {
  id: text('id').primaryKey(), expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(), token: text('token').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ipAddress'), userAgent: text('userAgent'), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  mfaVerifiedAt: integer('mfaVerifiedAt'),
});
export const account = sqliteTable('account', {
  id: text('id').primaryKey(), accountId: text('accountId').notNull(), providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), accessToken: text('accessToken'),
  refreshToken: text('refreshToken'), idToken: text('idToken'), accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }), scope: text('scope'), password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(), createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});
export const twoFactor = sqliteTable('twoFactor', {
  id: text('id').primaryKey(), secret: text('secret').notNull(), backupCodes: text('backupCodes').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  verified: integer('verified', { mode: 'boolean' }).default(true), failedVerificationCount: integer('failedVerificationCount').default(0),
  lockedUntil: integer('lockedUntil', { mode: 'timestamp_ms' }),
});
export const rateLimit = sqliteTable('rateLimit', {
  id: text('id').primaryKey(), key: text('key').notNull().unique(), count: integer('count').notNull(), lastRequest: integer('lastRequest').notNull(),
});
export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(), type: text('type').notNull(), aggregate_id: text('aggregate_id').notNull(),
  payload_json: text('payload_json').notNull(), status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0), available_at: text('available_at').notNull(),
  last_error: text('last_error'), created_at: text('created_at').notNull(), updated_at: text('updated_at').notNull(),
});
