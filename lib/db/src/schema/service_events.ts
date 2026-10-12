import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { services } from "./services";

export const serviceEvents = pgTable("service_events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
  type: text("type").notNull().default("info"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("info"),
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("service_events_org_external_unique").on(table.organizationId, table.externalId)]);

export type ServiceEvent = typeof serviceEvents.$inferSelect;
