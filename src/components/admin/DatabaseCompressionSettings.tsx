import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Switch,
  Text,
} from "@radix-ui/themes";
import { AlertTriangle, Save } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { requestAdminData } from "./databaseMaintenanceApi";

const compressionOptionSchema = z.object({
  mode: z.string().trim().min(1),
  supported: z.boolean(),
  algorithms: z.array(z.string()),
  reason: z.string().optional(),
  warning: z.string().optional(),
});
const compressionStatusSchema = z.object({
  driver: z.string().trim().min(1),
  available: z.boolean(),
  reason: z.string().optional(),
  storage: z.object({
    enabled: z.boolean(),
    mode: z.string().trim().min(1),
    algorithm: z.string().optional(),
    options: z.array(compressionOptionSchema),
  }),
  wal: z
    .object({
      visible: z.boolean(),
      supported: z.boolean(),
      enabled: z.boolean(),
      algorithm: z.string().optional(),
      algorithms: z.array(z.string()),
      reason: z.string().optional(),
      warning: z.string().optional(),
      requires_reconnect: z.boolean(),
    })
    .optional(),
});

type CompressionOption = z.infer<typeof compressionOptionSchema>;
type CompressionStatus = z.infer<typeof compressionStatusSchema>;
type TranslationFunction = ReturnType<typeof useTranslation>["t"];
type CompressionDraft = {
  storageEnabled: boolean;
  storageMode: string;
  storageAlgorithm: string;
  walEnabled: boolean;
  walAlgorithm: string;
};

function modeLabel(mode: string, t: TranslationFunction): string {
  return t(`settings.database.compression.modes.${mode}`, {
    defaultValue: mode,
  });
}

function algorithmLabel(algorithm: string, t: TranslationFunction): string {
  return t(`settings.database.compression.algorithms.${algorithm}`, {
    defaultValue: algorithm.toUpperCase(),
  });
}

function capabilityMessage(code: string | undefined, t: TranslationFunction) {
  if (!code) return undefined;
  return t(`settings.database.compression.messages.${code}`, {
    defaultValue: code,
  });
}

function firstSupportedOption(
  status: CompressionStatus,
): CompressionOption | undefined {
  return status.storage.options.find((option) => option.supported);
}

function draftFromStatus(status: CompressionStatus): CompressionDraft {
  const currentOption = status.storage.options.find(
    (option) => option.mode === status.storage.mode && option.supported,
  );
  const fallbackOption = firstSupportedOption(status);
  const storageMode =
    status.storage.mode === "mixed"
      ? "mixed"
      : currentOption?.mode || fallbackOption?.mode || "none";
  const storageAlgorithms =
    currentOption?.algorithms || fallbackOption?.algorithms || [];
  return {
    storageEnabled: status.storage.enabled,
    storageMode,
    storageAlgorithm: status.storage.algorithm || storageAlgorithms[0] || "",
    walEnabled: status.wal?.enabled ?? false,
    walAlgorithm:
      status.wal?.enabled &&
      status.wal.algorithms.includes(status.wal.algorithm || "")
        ? status.wal.algorithm || ""
        : status.wal?.algorithms[0] || "",
  };
}

function draftMatchesStatus(
  draft: CompressionDraft,
  status: CompressionStatus,
): boolean {
  if (draft.storageEnabled !== status.storage.enabled) return false;
  if (
    draft.storageEnabled &&
    (draft.storageMode !== status.storage.mode ||
      draft.storageAlgorithm !== (status.storage.algorithm || ""))
  ) {
    return false;
  }
  if (!status.wal?.visible) return true;
  if (draft.walEnabled !== status.wal.enabled) return false;
  return (
    !draft.walEnabled || draft.walAlgorithm === (status.wal.algorithm || "")
  );
}

function CompressionWarning({ code }: { code: string | undefined }) {
  const { t } = useTranslation();
  if (!code) return null;
  return (
    <Callout.Root color="amber" variant="surface">
      <Callout.Icon>
        <AlertTriangle size={17} />
      </Callout.Icon>
      <Callout.Text>{capabilityMessage(code, t)}</Callout.Text>
    </Callout.Root>
  );
}

export function DatabaseCompressionSettings({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const [status, setStatus] = React.useState<CompressionStatus | null>(null);
  const [draft, setDraft] = React.useState<CompressionDraft | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [irreversibleConfirmed, setIrreversibleConfirmed] =
    React.useState(false);

  const fetchCompression = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const fallbackMessage = t("settings.database.compression.load_error");
    try {
      const data = await requestAdminData(
        "/api/admin/database/compression",
        fallbackMessage,
      );
      const parsed = compressionStatusSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(t("settings.database.invalid_response"));
      }
      setStatus(parsed.data);
      setDraft(draftFromStatus(parsed.data));
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : String(fetchError);
      setStatus(null);
      setDraft(null);
      setError(
        message === fallbackMessage
          ? fallbackMessage
          : `${fallbackMessage}: ${message}`,
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (!visible) {
      setStatus(null);
      setDraft(null);
      setError(null);
      return;
    }
    void fetchCompression();
  }, [fetchCompression, visible]);

  const selectedOption = React.useMemo(
    () =>
      status?.storage.options.find(
        (option) => option.mode === draft?.storageMode,
      ),
    [draft?.storageMode, status],
  );
  const timescaleActive = status?.storage.mode === "timescaledb";
  const requiresIrreversibleConfirmation =
    !!draft?.storageEnabled &&
    draft.storageMode === "timescaledb" &&
    !timescaleActive;

  const setStorageEnabled = (enabled: boolean) => {
    if (!status || !draft) return;
    const fallback = firstSupportedOption(status);
    const needsFallback =
      draft.storageMode === "none" || draft.storageMode === "mixed";
    setDraft({
      ...draft,
      storageEnabled: enabled,
      storageMode:
        enabled && needsFallback ? fallback?.mode || "none" : draft.storageMode,
      storageAlgorithm:
        enabled && needsFallback
          ? fallback?.algorithms[0] || ""
          : draft.storageAlgorithm,
    });
  };

  const setStorageMode = (mode: string) => {
    if (!status || !draft) return;
    const option = status.storage.options.find(
      (candidate) => candidate.mode === mode,
    );
    if (!option?.supported) return;
    setDraft({
      ...draft,
      storageMode: mode,
      storageAlgorithm: option.algorithms.includes(draft.storageAlgorithm)
        ? draft.storageAlgorithm
        : option.algorithms[0] || "",
    });
  };

  const save = async () => {
    if (!status || !draft || saving) return;
    setConfirmOpen(false);
    setSaving(true);
    setError(null);
    try {
      const data = await requestAdminData(
        "/api/admin/database/compression",
        t("settings.database.compression.save_error"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storage_enabled: draft.storageEnabled,
            storage_mode: draft.storageMode,
            storage_algorithm: draft.storageAlgorithm,
            wal_enabled: draft.walEnabled,
            wal_algorithm: draft.walAlgorithm,
            confirm_irreversible: irreversibleConfirmed,
          }),
        },
      );
      const parsed = compressionStatusSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(t("settings.database.invalid_response"));
      }
      setStatus(parsed.data);
      setDraft(draftFromStatus(parsed.data));
      toast.success(t("settings.database.compression.save_success"));
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : String(saveError);
      toast.error(t("settings.database.compression.save_error"), {
        description: message,
      });
      await fetchCompression();
    } finally {
      setSaving(false);
      setIrreversibleConfirmed(false);
    }
  };

  if (!visible) return null;

  const changed = !!status && !!draft && !draftMatchesStatus(draft, status);
  const selectionValid =
    !draft?.storageEnabled ||
    (!!selectedOption?.supported && draft.storageMode !== "mixed");

  return (
    <>
      <div className="mt-3 border-t border-[var(--gray-a5)] pt-4">
        <Flex direction="column" gap="1">
          <Text size="3" weight="bold">
            {t("settings.database.compression.title")}
          </Text>
          <Text size="1" color="gray">
            {t("settings.database.compression.description")}
          </Text>
        </Flex>

        {loading ? (
          <Text as="div" size="2" color="gray" className="py-4">
            {t("loading")}
          </Text>
        ) : status && draft ? (
          <Flex direction="column" gap="4" mt="4">
            <div className="grid gap-3 border-b border-[var(--gray-a5)] pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
              <div className="min-w-0">
                <Flex align="center" gap="2">
                  <Switch
                    checked={draft.storageEnabled}
                    disabled={saving || timescaleActive}
                    onCheckedChange={setStorageEnabled}
                  />
                  <Text size="2" weight="medium">
                    {t("settings.database.compression.storage")}
                  </Text>
                </Flex>
                <Text as="div" size="1" color="gray" mt="1">
                  {t("settings.database.compression.storage_description")}
                </Text>
              </div>
              <Flex direction="column" gap="2" className="min-w-0">
                <Select.Root
                  value={draft.storageMode}
                  disabled={
                    !draft.storageEnabled || saving || timescaleActive
                  }
                  onValueChange={setStorageMode}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Content position="popper">
                    {draft.storageMode === "mixed" ? (
                      <Select.Item value="mixed" disabled>
                        {modeLabel("mixed", t)}
                      </Select.Item>
                    ) : null}
                    {status.storage.options.map((option) => (
                      <Select.Item
                        key={option.mode}
                        value={option.mode}
                        disabled={!option.supported}
                      >
                        {modeLabel(option.mode, t)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                {draft.storageEnabled &&
                (selectedOption?.algorithms.length ?? 0) > 0 ? (
                  <Select.Root
                    value={draft.storageAlgorithm}
                    disabled={saving || timescaleActive}
                    onValueChange={(storageAlgorithm) =>
                      setDraft({ ...draft, storageAlgorithm })
                    }
                  >
                    <Select.Trigger className="w-full" />
                    <Select.Content position="popper">
                      {selectedOption?.algorithms.map((algorithm) => (
                        <Select.Item key={algorithm} value={algorithm}>
                          {algorithmLabel(algorithm, t)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                ) : null}
              </Flex>
            </div>

            {status.storage.options.some((option) => !option.supported) ? (
              <Flex direction="column" gap="1">
                {status.storage.options
                  .filter((option) => !option.supported)
                  .map((option) => (
                    <Text key={option.mode} as="div" size="1" color="gray">
                      {modeLabel(option.mode, t)}:{" "}
                      {capabilityMessage(option.reason, t)}
                    </Text>
                  ))}
              </Flex>
            ) : null}

            {status.wal?.visible ? (
              <div className="grid gap-3 border-b border-[var(--gray-a5)] pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                <div className="min-w-0">
                  <Flex align="center" gap="2">
                    <Switch
                      checked={draft.walEnabled}
                      disabled={!status.wal.supported || saving}
                      onCheckedChange={(walEnabled) =>
                        setDraft({
                          ...draft,
                          walEnabled,
                          walAlgorithm:
                            (status.wal?.algorithms.includes(draft.walAlgorithm)
                              ? draft.walAlgorithm
                              : undefined) ||
                            status.wal?.algorithms[0] ||
                            "",
                        })
                      }
                    />
                    <Text size="2" weight="medium">
                      {t("settings.database.compression.wal")}
                    </Text>
                  </Flex>
                  <Text as="div" size="1" color="gray" mt="1">
                    {t("settings.database.compression.wal_description")}
                  </Text>
                  {!status.wal.supported ? (
                    <Text as="div" size="1" color="gray" mt="1">
                      {capabilityMessage(status.wal.reason, t)}
                    </Text>
                  ) : null}
                </div>
                {draft.walEnabled ? (
                  <Select.Root
                    value={draft.walAlgorithm}
                    disabled={!status.wal.supported || saving}
                    onValueChange={(walAlgorithm) =>
                      setDraft({ ...draft, walAlgorithm })
                    }
                  >
                    <Select.Trigger className="w-full" />
                    <Select.Content position="popper">
                      {status.wal.algorithms.map((algorithm) => (
                        <Select.Item key={algorithm} value={algorithm}>
                          {algorithmLabel(algorithm, t)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                ) : null}
              </div>
            ) : null}

            {status.storage.mode === "mixed" ? (
              <Callout.Root color="amber" variant="surface">
                <Callout.Icon>
                  <AlertTriangle size={17} />
                </Callout.Icon>
                <Callout.Text>
                  {t("settings.database.compression.mixed_warning")}
                </Callout.Text>
              </Callout.Root>
            ) : null}
            {timescaleActive ? (
              <Callout.Root color="amber" variant="surface">
                <Callout.Icon>
                  <AlertTriangle size={17} />
                </Callout.Icon>
                <Callout.Text>
                  {t("settings.database.compression.timescaledb_active")}
                </Callout.Text>
              </Callout.Root>
            ) : null}
            {draft.storageEnabled && !timescaleActive ? (
              <CompressionWarning code={selectedOption?.warning} />
            ) : null}
            {draft.walEnabled ? (
              <CompressionWarning code={status.wal?.warning} />
            ) : null}

            <Flex justify="end">
              <Button
                variant="soft"
                disabled={saving || !changed || !selectionValid}
                onClick={() => {
                  setIrreversibleConfirmed(false);
                  setConfirmOpen(true);
                }}
              >
                <Save size={16} />
                {saving
                  ? t("settings.database.compression.saving")
                  : t("settings.database.compression.apply")}
              </Button>
            </Flex>
          </Flex>
        ) : null}

        {error ? (
          <Text as="div" size="2" color="red" className="break-words py-3">
            {error}
          </Text>
        ) : null}
      </div>

      {status && draft ? (
        <Dialog.Root
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            setIrreversibleConfirmed(false);
          }}
        >
          <Dialog.Content maxWidth="520px">
            <Dialog.Title>
              {t("settings.database.compression.confirm_title")}
            </Dialog.Title>
            <Dialog.Description size="2">
              {t("settings.database.compression.confirm_description")}
            </Dialog.Description>
            {requiresIrreversibleConfirmation ? (
              <Flex direction="column" gap="3" mt="4">
                <CompressionWarning code={selectedOption?.warning} />
                <Text as="label" size="2">
                  <Flex align="start" gap="2">
                    <Checkbox
                      checked={irreversibleConfirmed}
                      onCheckedChange={(checked) =>
                        setIrreversibleConfirmed(checked === true)
                      }
                    />
                    <span>
                      {t(
                        "settings.database.compression.confirm_irreversible",
                      )}
                    </span>
                  </Flex>
                </Text>
              </Flex>
            ) : null}
            <Flex direction="column" gap="2" mt="4">
              <Text size="2">
                {t("settings.database.compression.storage")}:{" "}
                {draft.storageEnabled
                  ? `${modeLabel(draft.storageMode, t)}${
                      draft.storageAlgorithm
                        ? ` / ${algorithmLabel(draft.storageAlgorithm, t)}`
                        : ""
                    }`
                  : t("settings.database.compression.disabled")}
              </Text>
              {status.wal?.visible ? (
                <Text size="2">
                  {t("settings.database.compression.wal")}:{" "}
                  {draft.walEnabled
                    ? algorithmLabel(draft.walAlgorithm, t)
                    : t("settings.database.compression.disabled")}
                </Text>
              ) : null}
            </Flex>
            <Flex gap="3" mt="5" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                disabled={
                  requiresIrreversibleConfirmation && !irreversibleConfirmed
                }
                onClick={() => void save()}
              >
                <Save size={16} />
                {t("settings.database.compression.apply")}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      ) : null}
    </>
  );
}
