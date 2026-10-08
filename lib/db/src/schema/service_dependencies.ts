import { integer, pgTable, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { services } from "./services";

export const serviceDependencies = pgTable("service_dependencies", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  dependsOnId: integer("depends_on_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("service_dependencies_unique_edge_idx").on(t.serviceId, t.dependsOnId)
]);

export type ServiceDependency = typeof serviceDependencies.$inferSelect;
