import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { services } from "./services";

export const serviceMessages = pgTable("service_messages", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  author: text("author").notNull().default("system"),
  channel: text("channel").notNull().default("general"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ServiceMessage = typeof serviceMessages.$inferSelect;
