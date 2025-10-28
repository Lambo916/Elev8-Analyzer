import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const complianceReports = pgTable("compliance_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  entityName: text("entity_name").notNull(),
  entityType: text("entity_type").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  filingType: text("filing_type").notNull(),
  deadline: text("deadline"),
  htmlContent: text("html_content").notNull(),
  checksum: text("checksum").notNull(),
  metadata: json("metadata"),
  toolkitCode: text("toolkit_code").notNull().default('Elev8Analyzer'),
  ownerId: text("owner_id").notNull().default(''),
  userId: varchar("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  toolkitCreatedAtIndex: index("compliance_reports_toolkit_created_at_idx").on(table.toolkitCode, table.createdAt),
}));

export const insertComplianceReportSchema = createInsertSchema(complianceReports).omit({
  id: true,
  createdAt: true,
});

export type InsertComplianceReport = z.infer<typeof insertComplianceReportSchema>;
export type ComplianceReport = typeof complianceReports.$inferSelect;

export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull(),
  tool: text("tool").notNull().default('Elev8Analyzer'),
  reportCount: integer("report_count").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => ({
  uniqueIpTool: unique().on(table.ipAddress, table.tool),
  toolIpIndex: index("usage_tracking_tool_ip_idx").on(table.tool, table.ipAddress),
}));

export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({
  id: true,
  lastUpdated: true,
});

export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;

export const savedElev8Reports = pgTable("saved_elev8_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull(),
  tool: text("tool").notNull().default('Elev8Analyzer'),
  reportName: text("report_name").notNull(),
  analysisData: json("analysis_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  toolCreatedAtIndex: index("saved_elev8_reports_tool_created_at_idx").on(table.tool, table.createdAt),
  toolIpIndex: index("saved_elev8_reports_tool_ip_idx").on(table.tool, table.ipAddress),
}));

export const insertSavedElev8ReportSchema = createInsertSchema(savedElev8Reports).omit({
  id: true,
  createdAt: true,
});

export type InsertSavedElev8Report = z.infer<typeof insertSavedElev8ReportSchema>;
export type SavedElev8Report = typeof savedElev8Reports.$inferSelect;
