import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("healthy"),
  ownerTeam: text("owner_team"),
  criticality: text("criticality").notNull().default("medium"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Service = typeof services.$inferSelect;
