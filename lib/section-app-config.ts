import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGuideXmlFromJsonb, type GuideItem } from "@/lib/installation-guide-xml";
import { fetchUnifiedSectionByCatalogId } from "@/lib/section-catalog";

export type SectionGuideConfig = {
  sectionId: string;
  name: string;
  guideMode: boolean;
  guide_enabled: boolean;
  guide_xml: GuideItem[] | null;
  joint_types: string[] | null;
};

/** Guide-mode is active only when explicitly enabled and guide_xml has items. */
export function isGuideModeActive(
  guideEnabled: boolean | null | undefined,
  guideXml: GuideItem[] | null | undefined
): boolean {
  return guideEnabled === true && Array.isArray(guideXml) && guideXml.length > 0;
}

export function jointTypesFromAppConfig(
  appConfig: Record<string, unknown> | null | undefined
): string[] | null {
  const raw = appConfig?.joint_types;
  if (!Array.isArray(raw)) return null;
  const types = raw.filter((t): t is string => typeof t === "string");
  return types.length > 0 ? types : null;
}

/**
 * Parse guide-mode config from sections.app_config.
 * joint_types and guide_xml are only read when guide-mode is active.
 */
export function guideConfigFromAppConfig(
  appConfig: Record<string, unknown> | null | undefined
): Pick<SectionGuideConfig, "guideMode" | "guide_enabled" | "guide_xml" | "joint_types"> {
  const explicitlyEnabled = appConfig?.guide_enabled === true;
  const guide_xml = explicitlyEnabled
    ? normalizeGuideXmlFromJsonb(appConfig?.guide_xml)
    : null;
  const guideMode = isGuideModeActive(explicitlyEnabled, guide_xml);

  return {
    guideMode,
    guide_enabled: guideMode,
    guide_xml: guideMode ? guide_xml : null,
    joint_types: guideMode ? jointTypesFromAppConfig(appConfig) : null,
  };
}

export async function fetchSectionGuideConfig(
  supabase: SupabaseClient,
  sectionId: string,
  options?: { crewIds?: string[] }
): Promise<SectionGuideConfig | null> {
  const unified = await fetchUnifiedSectionByCatalogId(supabase, sectionId, options);
  if (!unified) return null;
  const cfg = guideConfigFromAppConfig(unified.app_config ?? null);
  return {
    sectionId: unified.id,
    name: unified.name,
    ...cfg,
  };
}

export function recordMatchesJointTypes(
  jointType: string | null | undefined,
  allowed: string[] | null | undefined
): boolean {
  if (!allowed?.length) return true;
  if (!jointType) return false;
  return allowed.includes(jointType);
}

export function guideModeContextFields(
  cfg: Pick<SectionGuideConfig, "guideMode" | "guide_xml" | "joint_types">
): Pick<SectionGuideConfig, "guide_enabled" | "guide_xml" | "joint_types"> | Record<string, never> {
  if (!cfg.guideMode) return {};
  return {
    guide_enabled: true,
    guide_xml: cfg.guide_xml,
    joint_types: cfg.joint_types,
  };
}
