// ABOUTME: Bundle loading and metadata management for pattern bundles
// ABOUTME: Handles marketplace bundles, personal bundles, and workspace-specific bundles

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as yaml from "js-yaml";
import type { DataDB } from "./data-db";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Bundle metadata as stored in bundle.yml
 */
export interface BundleMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  created_at: string;
  updated_at: string;
  installable: boolean;
}

/**
 * Bundle type discriminator
 */
export type BundleType = "personal" | "workspace" | "marketplace";

/**
 * Full bundle (metadata only - patterns accessed via pattern-groups-db)
 */
export interface Bundle extends BundleMetadata {
  type: BundleType;
  installed: boolean;
  pattern_count: number;
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Detect if we're running as a compiled Bun binary.
 */
function isCompiledBinary(): boolean {
  return import.meta.dir.startsWith("/$bunfs");
}

/**
 * Get default pattern-bundles path based on execution context.
 */
function getDefaultBundlesPath(): string {
  if (isCompiledBinary()) {
    // In compiled binary, bundles are at sibling path to the binary
    // Binary: cli-dist/dist/server
    // Bundles: cli-dist/dist/pattern-bundles
    return join(dirname(process.execPath), "pattern-bundles");
  }
  // Dev mode: navigate from server/src/lib → pattern-bundles
  return join(import.meta.dir, "..", "..", "..", "pattern-bundles");
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates bundle metadata structure
 */
function isValidBundleMetadata(data: unknown): data is BundleMetadata {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (typeof obj.id !== "string" || obj.id.trim() === "") return false;
  if (typeof obj.name !== "string" || obj.name.trim() === "") return false;
  if (typeof obj.description !== "string") return false;
  if (typeof obj.created_at !== "string") return false;
  if (typeof obj.updated_at !== "string") return false;
  if (typeof obj.installable !== "boolean") return false;

  // Check optional fields
  if (obj.author !== undefined && typeof obj.author !== "string") return false;
  if (obj.version !== undefined && typeof obj.version !== "string") return false;

  return true;
}

// ============================================================================
// Pattern Counting Helper
// ============================================================================

/**
 * Count patterns in a bundle directory by counting subdirectories with metadata.yml
 * Does NOT load pattern content - just counts for bundle metadata
 */
function countPatternsInBundle(bundleDir: string): number {
  try {
    const entries = readdirSync(bundleDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      // Skip non-directories and special files
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;

      const patternDir = join(bundleDir, entry.name);
      const metadataPath = join(patternDir, "metadata.yml");

      // Count as pattern if it has metadata.yml
      if (existsSync(metadataPath)) {
        count++;
      }
    }

    return count;
  } catch (error) {
    console.error(`Error counting patterns in bundle ${bundleDir}:`, error);
    return 0;
  }
}

// ============================================================================
// Bundle Loading
// ============================================================================

/**
 * Load all marketplace bundles from pattern-bundles directory
 */
export function loadMarketplaceBundles(bundlesPath?: string): Map<string, Bundle> {
  const bundles = new Map<string, Bundle>();
  const finalBundlesPath = bundlesPath || getDefaultBundlesPath();

  if (!existsSync(finalBundlesPath)) {
    console.warn(`Pattern bundles directory not found: ${finalBundlesPath}`);
    return bundles;
  }

  const entries = readdirSync(finalBundlesPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip non-directories
    if (!entry.isDirectory()) continue;

    const bundleDir = join(finalBundlesPath, entry.name);
    const bundleMetadataPath = join(bundleDir, "bundle.yml");

    // Skip if no bundle.yml
    if (!existsSync(bundleMetadataPath)) {
      console.warn(`Bundle ${entry.name} missing bundle.yml, skipping`);
      continue;
    }

    try {
      // Parse bundle metadata
      const content = readFileSync(bundleMetadataPath, "utf-8");
      const data = yaml.load(content);

      if (!isValidBundleMetadata(data)) {
        console.warn(`Bundle ${entry.name} has invalid metadata, skipping`);
        continue;
      }

      // Count patterns in bundle directory (don't load full pattern content)
      const pattern_count = countPatternsInBundle(bundleDir);

      // Create bundle with metadata only
      const bundle: Bundle = {
        ...data,
        type: "marketplace",
        installed: false, // Hardcoded for now
        pattern_count,
      };

      bundles.set(data.id, bundle);
    } catch (error) {
      console.error(`Error loading bundle ${entry.name}:`, error);
    }
  }

  return bundles;
}

/**
 * Get a single marketplace bundle by ID (metadata only)
 * Note: To access patterns in this bundle, use pattern-groups-db after bundle is installed/seeded
 */
export function getMarketplaceBundleById(bundleId: string, bundlesPath?: string): Bundle | undefined {
  const finalBundlesPath = bundlesPath || getDefaultBundlesPath();
  const bundleDir = join(finalBundlesPath, bundleId);

  if (!existsSync(bundleDir)) {
    return undefined;
  }

  const bundleMetadataPath = join(bundleDir, "bundle.yml");
  if (!existsSync(bundleMetadataPath)) {
    return undefined;
  }

  try {
    // Parse bundle metadata
    const content = readFileSync(bundleMetadataPath, "utf-8");
    const data = yaml.load(content);

    if (!isValidBundleMetadata(data)) {
      return undefined;
    }

    // Count patterns in bundle directory (don't load full pattern content)
    const pattern_count = countPatternsInBundle(bundleDir);

    const bundle: Bundle = {
      ...data,
      type: "marketplace",
      installed: false,
      pattern_count,
    };

    return bundle;
  } catch (error) {
    console.error(`Error loading bundle ${bundleId}:`, error);
    return undefined;
  }
}

/**
 * Get personal bundle for user (from user_profile table)
 * Note: To access patterns, use pattern-groups-db with scope='user'
 */
export function getPersonalBundle(dataDb: DataDB): Bundle {
  const userName = dataDb.getUserName();
  const bundleName = userName ? `${userName}'s Patterns` : "My Patterns";

  const bundle: Bundle = {
    id: "user",
    name: bundleName,
    description: "Your personal patterns",
    type: "personal",
    installed: true,
    installable: false,
    pattern_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return bundle;
}

/**
 * Get workspace-specific bundle
 * Note: To access patterns, use pattern-groups-db with scope='workspace' and workspaceId
 */
export function getWorkspaceBundle(dataDb: DataDB, workspaceId: string): Bundle | null {
  const workspace = dataDb.getWorkspaceById(workspaceId);
  if (!workspace) {
    return null;
  }

  // Use workspace title if available, otherwise default
  const workspaceName = workspace.title || "Workspace";

  const bundle: Bundle = {
    id: "workspace",
    name: `${workspaceName} Patterns`,
    description: "Workspace-specific patterns",
    type: "workspace",
    installed: true,
    installable: false,
    pattern_count: 0,
    created_at: workspace.created_at,
    updated_at: workspace.last_used,
  };

  return bundle;
}

/**
 * Get all bundles (personal, workspace, marketplace)
 */
export function getAllBundles(dataDb: DataDB, workspaceId: string, bundlesPath?: string): Bundle[] {
  const bundles: Bundle[] = [];

  // Add personal bundle
  bundles.push(getPersonalBundle(dataDb));

  // Add workspace bundle if workspace exists
  const workspaceBundle = getWorkspaceBundle(dataDb, workspaceId);
  if (workspaceBundle) {
    bundles.push(workspaceBundle);
  }

  // Add marketplace bundles
  const marketplaceBundles = loadMarketplaceBundles(bundlesPath);
  bundles.push(...Array.from(marketplaceBundles.values()));

  return bundles;
}

/**
 * Get single bundle by ID (checks all bundle types)
 * Returns metadata only - use pattern-groups-db to access actual patterns
 */
export function getBundleById(
  bundleId: string,
  dataDb: DataDB,
  workspaceId: string,
  bundlesPath?: string,
): Bundle | null {
  // Check for personal bundle
  if (bundleId === "user") {
    return getPersonalBundle(dataDb);
  }

  // Check for workspace bundle
  if (bundleId === "workspace") {
    return getWorkspaceBundle(dataDb, workspaceId);
  }

  // Check marketplace bundles
  const marketplaceBundle = getMarketplaceBundleById(bundleId, bundlesPath);
  return marketplaceBundle || null;
}
