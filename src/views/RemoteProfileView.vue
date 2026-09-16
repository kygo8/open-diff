<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import RemotePathBrowser from '@/components/remote/RemotePathBrowser.vue'
import { isTauriRuntime } from '@/app/desktopDrop'
import {
  buildRemoteAuthorizeUrl,
  extractOAuthAccessToken,
  isOAuthCloudProtocol,
} from '@/app/remoteOAuth'
import { openPathExternal } from '@/api/integration'
import {
  applyRemoteProfileConnectionDefaults,
  deleteLocalRemoteProfile,
  loadLocalRemoteProfiles,
  saveLocalRemoteProfiles,
  upsertLocalRemoteProfile,
  type LocalRemoteProfile,
  loadRemoteProfileDefaults,
} from '@/app/remoteProfilesLocal'
import { useI18n } from '@/i18n'
import { usePolicyStore } from '@/stores/policy'
import {
  deleteRemoteProfile,
  formatRemoteUri,
  isImplementedRemoteProtocol,
  listRemoteProfiles,
  saveRemoteProfile,
  testRemoteProfile,
  type RemoteProtocol,
  type RemoteProfileView,
} from '@/api/remote'

type CredentialReferenceKind = 'system-keychain' | 'environment' | 'profile-store'

interface RemoteEndpoint {
  host: string
  port: number | null
  rootPath: string
}

interface CredentialReference {
  kind: CredentialReferenceKind
  key: string
}

interface RemoteProfile {
  id: string
  name: string
  protocol: RemoteProtocol
  endpoint: RemoteEndpoint
  credentialRef: CredentialReference
}

interface RemoteProfileDraft {
  id: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number | null
  rootPath: string
  region: string
  pathStyle: boolean
  credentialKind: CredentialReferenceKind
  credentialKey: string
  username: string
  password: string
  oauthClientId: string
  oauthPaste: string
  uri: string
  implemented: boolean
}

const profiles = ref<RemoteProfile[]>([])
const { t } = useI18n()
const policy = usePolicyStore()
const selectedProfileId = ref('')
const draft = ref<RemoteProfileDraft>(toDraft(emptyProfile()))
const testStatusKey = ref(initialTestStatusKey())
const testStatusParams = ref<Record<string, string | number>>({})
const testing = ref(false)
const showRemoteBrowser = ref(false)
const persistenceMode = ref<'desktop' | 'local'>('local')

const sortedProfiles = computed(() =>
  [...profiles.value].sort((left, right) => left.name.localeCompare(right.name)),
)
const selectedProfile = computed(() =>
  profiles.value.find((profile) => profile.id === selectedProfileId.value),
)
const profileSummary = computed(() => {
  const port = draft.value.port ? `:${String(draft.value.port)}` : ''
  const root = draft.value.rootPath || '/'

  return `${protocolLabel(draft.value.protocol)} -> ${draft.value.host}${port}${root}`
})
const credentialSummary = computed(
  () => `${credentialKindLabel(draft.value.credentialKind)}: ${draft.value.credentialKey || '--'}`,
)
const testStatus = computed(() => t(testStatusKey.value, testStatusParams.value))
const canTestProfile = computed(
  () =>
    isTauriRuntime() &&
    isImplementedRemoteProtocol(draft.value.protocol) &&
    Boolean(draft.value.host.trim()) &&
    Boolean((draft.value.id || selectedProfileId.value).trim()),
)
const canBrowseProfile = computed(() => canTestProfile.value)
const canSaveProfile = computed(
  () => policy.remoteProfiles && isImplementedRemoteProtocol(draft.value.protocol),
)
const testDisabledReasonKey = computed(() => {
  if (!isTauriRuntime()) {
    return 'status.remoteTestRequiresDesktop'
  }

  if (!isImplementedRemoteProtocol(draft.value.protocol)) {
    return 'status.remoteUnavailable'
  }

  if (!draft.value.host.trim()) {
    return 'status.remoteNoHost'
  }

  if (!(draft.value.id || selectedProfileId.value).trim()) {
    return 'status.remoteSaveBeforeTest'
  }

  return ''
})

onMounted(() => {
  void loadPersistedProfiles()
})

async function loadPersistedProfiles(): Promise<void> {
  try {
    const loaded = await listRemoteProfiles()

    persistenceMode.value = 'desktop'
    applyViews(loaded)
    mirrorViewsToLocal(loaded)

    if (loaded.length === 0) {
      createNewProfile()
      setTestStatus(initialTestStatusKey())
    }

    return
  } catch {
    persistenceMode.value = 'local'
  }

  const local = loadLocalRemoteProfiles()

  if (local.length === 0) {
    createNewProfile()
    setTestStatus(initialTestStatusKey())

    return
  }

  applyLocalProfiles(local)
  setTestStatus(initialTestStatusKey())
}

function selectProfile(profileId: string): void {
  const profile = profiles.value.find((item) => item.id === profileId)

  if (!profile) {
    return
  }

  selectedProfileId.value = profile.id
  draft.value = toDraft(profile)
  setTestStatus(testDisabledReasonKey.value || initialTestStatusKey())
}

function createNewProfile(): void {
  selectedProfileId.value = ''
  draft.value = toDraft(emptyProfile())
  setTestStatus(testDisabledReasonKey.value || initialTestStatusKey())
}

async function saveProfile(): Promise<void> {
  if (!canSaveProfile.value) {
    return
  }

  const nextProfile = fromDraft(draft.value)

  try {
    const saved = await saveRemoteProfile({
      id: nextProfile.id,
      name: nextProfile.name,
      protocol: nextProfile.protocol,
      host: nextProfile.endpoint.host,
      port: nextProfile.endpoint.port,
      rootPath: nextProfile.endpoint.rootPath,
      username: draft.value.username.trim() || undefined,
      password: policy.savePasswords ? draft.value.password || undefined : undefined,
      region: draft.value.protocol === 's3' ? draft.value.region.trim() || null : null,
      pathStyle: draft.value.protocol === 's3' ? draft.value.pathStyle : null,
    })

    persistenceMode.value = 'desktop'
    applyViews(saved, nextProfile.id)
    mirrorViewsToLocal(saved)
    if (draft.value.oauthClientId.trim()) {
      const mirrored = loadLocalRemoteProfiles()
      const existing = mirrored.find((profile) => profile.id === nextProfile.id)

      upsertLocalRemoteProfile(mirrored, {
        ...applyRemoteProfileConnectionDefaults({
          id: nextProfile.id,
          name: nextProfile.name,
          protocol: nextProfile.protocol,
          host: nextProfile.endpoint.host,
          port: nextProfile.endpoint.port,
          rootPath: nextProfile.endpoint.rootPath,
          username: draft.value.username.trim() || existing?.username,
          oauthClientId: draft.value.oauthClientId.trim(),
          connectionTimeoutSeconds: existing?.connectionTimeoutSeconds,
          passiveFtp: existing?.passiveFtp,
        }),
      })
    }
    draft.value.password = ''
    setTestStatus(testDisabledReasonKey.value || initialTestStatusKey())
  } catch {
    persistenceMode.value = 'local'
    const clientId = draft.value.oauthClientId

    persistLocalProfile(nextProfile, draft.value.username.trim() || undefined)
    selectedProfileId.value = nextProfile.id
    draft.value = {
      ...toDraft(nextProfile),
      username: draft.value.username,
      oauthClientId: clientId,
      password: '',
      uri: formatRemoteUri(nextProfile.protocol, nextProfile.id, nextProfile.endpoint.rootPath),
    }
    setTestStatus(testDisabledReasonKey.value || initialTestStatusKey())
  }
}

async function deleteProfile(): Promise<void> {
  if (!selectedProfileId.value) {
    return
  }

  const removedId = selectedProfileId.value

  try {
    const remaining = await deleteRemoteProfile(removedId)

    persistenceMode.value = 'desktop'
    applyViews(remaining)
    mirrorViewsToLocal(remaining)
  } catch {
    persistenceMode.value = 'local'
    const remaining = deleteLocalRemoteProfile(profiles.value.map(toLocalProfile), removedId)

    applyLocalProfiles(remaining)
  }

  if (profiles.value.length === 0) {
    createNewProfile()

    return
  }

  const nextProfile = sortedProfiles.value[0]

  selectedProfileId.value = nextProfile.id
  draft.value = toDraft(nextProfile)
  setTestStatus(testDisabledReasonKey.value || initialTestStatusKey())
}

async function testProfileConnection(): Promise<void> {
  if (!canTestProfile.value) {
    setTestStatus(testDisabledReasonKey.value || 'status.remoteUnavailable')

    return
  }

  testing.value = true

  try {
    if (!profiles.value.some((profile) => profile.id === draft.value.id) || draft.value.password) {
      await saveProfile()
    }

    const detail = await testRemoteProfile(draft.value.id || selectedProfileId.value)

    setTestStatus('status.remoteConnected', { detail })
  } catch (event) {
    setTestStatus('status.remoteFailed', {
      detail: event instanceof Error ? event.message : String(event),
    })
  } finally {
    testing.value = false
  }
}

async function browseProfilePath(): Promise<void> {
  if (!canBrowseProfile.value) {
    setTestStatus(testDisabledReasonKey.value || 'status.remoteBrowseRequiresDesktop')

    return
  }

  if (!profiles.value.some((profile) => profile.id === draft.value.id) || draft.value.password) {
    await saveProfile()
  }

  if (!(draft.value.id || selectedProfileId.value)) {
    setTestStatus('status.remoteBrowseNeedsProfile')

    return
  }

  showRemoteBrowser.value = true
}

function applyBrowsedRootPath(path: string): void {
  draft.value.rootPath = path || '/'
  showRemoteBrowser.value = false
  setTestStatus('status.remoteBrowseReady', {
    count: 0,
    path: draft.value.rootPath,
  })
}

function setTestStatus(key: string, params: Record<string, string | number> = {}): void {
  testStatusKey.value = key
  testStatusParams.value = params
}

function initialTestStatusKey(): string {
  return isTauriRuntime() ? 'status.remoteUnavailable' : 'status.remoteTestRequiresDesktop'
}

function applyViews(views: RemoteProfileView[], selectedId = selectedProfileId.value): void {
  profiles.value = views.map((view) => ({
    id: view.id,
    name: view.name,
    protocol: view.protocol,
    endpoint: {
      host: view.host,
      port: view.port,
      rootPath: view.rootPath,
    },
    credentialRef: {
      kind: 'profile-store',
      key: view.id,
    },
  }))

  if (profiles.value.length === 0) {
    selectedProfileId.value = ''
    draft.value = toDraft(emptyProfile())

    return
  }

  const selected = profiles.value.find((profile) => profile.id === selectedId) ?? profiles.value[0]

  selectedProfileId.value = selected.id
  const localMatch = loadLocalRemoteProfiles().find((profile) => profile.id === selected.id)

  draft.value = {
    ...toDraft(selected),
    username: views.find((view) => view.id === selected.id)?.username ?? '',
    oauthClientId: localMatch?.oauthClientId ?? '',
    uri: views.find((view) => view.id === selected.id)?.uri ?? '',
    implemented: isImplementedRemoteProtocol(selected.protocol),
  }
}

function applyLocalProfiles(
  local: LocalRemoteProfile[],
  selectedId = selectedProfileId.value,
): void {
  profiles.value = local.map((profile) => ({
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    endpoint: {
      host: profile.host,
      port: profile.port,
      rootPath: profile.rootPath,
    },
    credentialRef: {
      kind: 'profile-store',
      key: profile.id,
    },
  }))

  if (profiles.value.length === 0) {
    selectedProfileId.value = ''
    draft.value = toDraft(emptyProfile())

    return
  }

  const selected = profiles.value.find((profile) => profile.id === selectedId) ?? profiles.value[0]
  const source = local.find((profile) => profile.id === selected.id)

  selectedProfileId.value = selected.id
  draft.value = {
    ...toDraft(selected),
    username: source?.username ?? '',
    oauthClientId: source?.oauthClientId ?? '',
    uri: formatRemoteUri(selected.protocol, selected.id, selected.endpoint.rootPath),
    implemented: isImplementedRemoteProtocol(selected.protocol),
  }
}

function persistLocalProfile(nextProfile: RemoteProfile, username?: string): void {
  const local = upsertLocalRemoteProfile(profiles.value.map(toLocalProfile), {
    ...applyRemoteProfileConnectionDefaults({
      id: nextProfile.id,
      name: nextProfile.name,
      protocol: nextProfile.protocol,
      host: nextProfile.endpoint.host,
      port: nextProfile.endpoint.port,
      rootPath: nextProfile.endpoint.rootPath,
      username,
      oauthClientId: draft.value.oauthClientId.trim() || undefined,
    }),
  })

  applyLocalProfiles(local, nextProfile.id)
}

function mirrorViewsToLocal(views: RemoteProfileView[]): void {
  saveLocalRemoteProfiles(
    views.map((view) => ({
      id: view.id,
      name: view.name,
      protocol: view.protocol,
      host: view.host,
      port: view.port,
      rootPath: view.rootPath,
      username: view.username ?? undefined,
    })),
  )
}

function toLocalProfile(profile: RemoteProfile): LocalRemoteProfile {
  const existing = loadLocalRemoteProfiles().find((item) => item.id === profile.id)

  return applyRemoteProfileConnectionDefaults({
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    host: profile.endpoint.host,
    port: profile.endpoint.port,
    rootPath: profile.endpoint.rootPath,
    connectionTimeoutSeconds: existing?.connectionTimeoutSeconds,
    passiveFtp: existing?.passiveFtp,
  })
}

function toDraft(profile: RemoteProfile): RemoteProfileDraft {
  const defaults = loadRemoteProfileDefaults()

  return {
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    host: profile.endpoint.host,
    port: profile.endpoint.port,
    rootPath: profile.endpoint.rootPath,
    region: '',
    pathStyle: false,
    credentialKind: profile.credentialRef.kind,
    credentialKey: profile.credentialRef.key,
    username: profile.id ? '' : defaults.defaultUsername || '',
    password: '',
    oauthClientId: '',
    oauthPaste: '',
    uri: '',
    implemented: isImplementedRemoteProtocol(profile.protocol),
  }
}

function fromDraft(source: RemoteProfileDraft): RemoteProfile {
  const name = valueOrFallback(source.name, loadRemoteProfileDefaults().defaultName)

  return {
    id: source.id || slugify(name),
    name,
    protocol: source.protocol,
    endpoint: {
      host: source.host.trim(),
      port: source.port,
      rootPath: source.rootPath.trim() || '/',
    },
    credentialRef: {
      kind: source.credentialKind,
      key: source.credentialKey.trim(),
    },
  }
}

function emptyProfile(): RemoteProfile {
  const defaults = loadRemoteProfileDefaults()
  let defaultPort: number | null = defaults.defaultPort

  if (defaultPort === null) {
    if (defaults.defaultProtocol === 'ftp' || defaults.defaultProtocol === 'ftps') {
      defaultPort = 21
    } else if (defaults.defaultProtocol === 'sftp') {
      defaultPort = 22
    }
  }

  return {
    id: '',
    name: defaults.defaultName,
    protocol: defaults.defaultProtocol,
    endpoint: {
      host: defaults.defaultHost || '',
      port: defaultPort,
      rootPath: defaults.defaultRootPath || '/',
    },
    credentialRef: {
      kind: 'system-keychain',
      key: '',
    },
  }
}

function valueOrFallback(value: string, fallback: string): string {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : fallback
}

function slugify(value: string): string {
  const fallbackId = `remote-profile-${String(profiles.value.length + 1)}`

  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/(^-|-$)/gu, '') || fallbackId
  )
}

async function openOAuthAuthorizeUrl(): Promise<void> {
  if (!isOAuthCloudProtocol(draft.value.protocol)) {
    return
  }

  const url = buildRemoteAuthorizeUrl(draft.value.protocol, draft.value.oauthClientId)

  if (!url) {
    setTestStatus('status.rawMessage', { message: t('ui.oauthClientIdHint') })

    return
  }

  try {
    await openPathExternal(url)
    setTestStatus('status.rawMessage', { message: t('ui.oauthHelperHint') })
  } catch (event) {
    setTestStatus('status.remoteFailed', {
      detail: event instanceof Error ? event.message : String(event),
    })
  }
}

function applyOAuthPaste(): void {
  const token = extractOAuthAccessToken(draft.value.oauthPaste)

  if (!token) {
    setTestStatus('status.rawMessage', { message: t('ui.oauthPasteRedirect') })

    return
  }

  draft.value.password = token
  draft.value.oauthPaste = ''
  setTestStatus('status.rawMessage', { message: t('ui.oauthApplyPaste') })
}

function protocolLabel(protocol: RemoteProtocol): string {
  const labels: Record<RemoteProtocol, string> = {
    dropbox: 'ui.dropbox',
    ftp: 'ui.ftp',
    ftps: 'ui.ftps',
    'one-drive': 'ui.onedrive',
    s3: 'ui.s3',
    sftp: 'ui.sftp',
    subversion: 'ui.subversion',
    'web-dav': 'ui.webDav',
  }

  return t(labels[protocol])
}

function credentialKindLabel(kind: CredentialReferenceKind): string {
  const labels: Record<CredentialReferenceKind, string> = {
    environment: 'ui.environmentVariable',
    'profile-store': 'ui.profileStore',
    'system-keychain': 'ui.systemKeychain',
  }

  return t(labels[kind])
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.remoteProfiles')"
    :eyebrow="$t('ui.remote')"
    :subtitle="profileSummary"
    :inspector-label="$t('ui.remoteProfileInspector')"
  >
    <section class="remote-profile-view">
      <p
        v-if="!policy.remoteProfiles"
        class="remote-unavailable"
        data-testid="policy-remote-disabled"
      >
        {{ $t('ui.policyRemoteDisabled') }}
      </p>
      <p
        v-else
        class="remote-unavailable"
        data-testid="remote-unavailable-notice"
      >
        {{
          persistenceMode === 'desktop'
            ? $t('ui.remoteNotImplemented')
            : $t('ui.remoteLocalPersistenceHint')
        }}
      </p>
      <header class="profile-header">
        <div>
          <p class="eyebrow">{{ $t('ui.settings') }}</p>
          <h1>{{ $t('ui.remoteProfiles') }}</h1>
        </div>
        <div class="profile-count">
          <strong>{{ profiles.length }}</strong>
          <span>{{ $t('ui.profileCountLabel') }}</span>
        </div>
      </header>

      <section
        v-if="policy.remoteProfiles"
        class="profile-workspace"
      >
        <aside class="profile-list-panel">
          <div class="panel-title">
            <h2>{{ $t('ui.profiles') }}</h2>
            <button
              type="button"
              data-testid="new-remote-profile"
              @click="createNewProfile"
            >
              {{ $t('ui.new') }}
            </button>
          </div>
          <div
            class="profile-list"
            data-testid="remote-profile-list"
          >
            <button
              v-for="profile in sortedProfiles"
              :key="profile.id"
              type="button"
              class="profile-row"
              :class="{ active: profile.id === selectedProfileId }"
              :data-testid="`select-remote-profile-${profile.id}`"
              @click="selectProfile(profile.id)"
            >
              <span>{{ profile.name }}</span>
              <small>{{ protocolLabel(profile.protocol) }} · {{ profile.endpoint.host }}</small>
            </button>
          </div>
        </aside>

        <section
          class="profile-detail-panel"
          data-testid="remote-profile-detail"
        >
          <div class="panel-title">
            <h2>{{ $t('ui.profileDetails') }}</h2>
            <div class="profile-actions">
              <button
                type="button"
                data-testid="test-remote-profile"
                :disabled="!canTestProfile || testing"
                @click="testProfileConnection"
              >
                {{ $t('ui.test') }}
              </button>
              <button
                type="button"
                data-testid="browse-remote-profile"
                :disabled="!canBrowseProfile || testing"
                @click="browseProfilePath"
              >
                {{ $t('ui.browseRemote') }}
              </button>
              <button
                type="button"
                data-testid="delete-remote-profile"
                :disabled="!selectedProfile"
                @click="deleteProfile"
              >
                {{ $t('ui.delete') }}
              </button>
              <button
                type="button"
                data-testid="save-remote-profile"
                :disabled="!canSaveProfile"
                @click="saveProfile"
              >
                {{ $t('ui.save') }}
              </button>
            </div>
          </div>

          <p
            class="profile-summary"
            data-testid="remote-profile-summary"
          >
            {{ profileSummary }}
          </p>

          <div class="profile-form">
            <label>
              <span>{{ $t('ui.name') }}</span>
              <input
                v-model="draft.name"
                data-testid="remote-profile-name-input"
                type="text"
              />
            </label>
            <label>
              <span>{{ $t('ui.protocol') }}</span>
              <select
                v-model="draft.protocol"
                data-testid="remote-profile-protocol-select"
              >
                <option value="ftp">{{ $t('ui.ftp') }}</option>
                <option value="ftps">{{ $t('ui.ftps') }}</option>
                <option value="sftp">{{ $t('ui.sftp') }}</option>
                <option value="web-dav">{{ $t('ui.webDav') }}</option>
                <option value="s3">{{ $t('ui.s3') }}</option>
                <option value="dropbox">
                  {{ $t('ui.dropbox') }}
                </option>
                <option value="one-drive">
                  {{ $t('ui.onedrive') }}
                </option>
                <option value="subversion">{{ $t('ui.subversion') }}</option>
              </select>
            </label>
            <label>
              <span>{{ $t('ui.host') }}</span>
              <input
                v-model="draft.host"
                data-testid="remote-profile-host-input"
                type="text"
              />
            </label>
            <label>
              <span>{{ $t('ui.port') }}</span>
              <input
                v-model.number="draft.port"
                data-testid="remote-profile-port-input"
                type="number"
                min="1"
                max="65535"
              />
            </label>
            <label>
              <span>{{ draft.protocol === 's3' ? $t('ui.s3Bucket') : $t('ui.rootPath') }}</span>
              <input
                v-model="draft.rootPath"
                data-testid="remote-profile-root-input"
                type="text"
              />
            </label>
            <label v-if="draft.protocol === 's3'">
              <span>{{ $t('ui.s3Region') }}</span>
              <input
                v-model="draft.region"
                data-testid="remote-profile-region-input"
                type="text"
                :placeholder="$t('ui.s3RegionPlaceholder')"
              />
            </label>
            <label
              v-if="draft.protocol === 's3'"
              class="checkbox-row"
            >
              <input
                v-model="draft.pathStyle"
                data-testid="remote-profile-path-style-input"
                type="checkbox"
              />
              <span>{{ $t('ui.s3PathStyle') }}</span>
            </label>
            <label>
              <span>{{ $t('ui.credentialReference') }}</span>
              <select
                v-model="draft.credentialKind"
                data-testid="remote-profile-credential-kind-select"
              >
                <option value="system-keychain">{{ $t('ui.systemKeychain') }}</option>
                <option value="environment">{{ $t('ui.environmentVariable') }}</option>
                <option value="profile-store">{{ $t('ui.profileStore') }}</option>
              </select>
            </label>
            <label>
              <span>{{
                draft.protocol === 's3'
                  ? $t('ui.accessKeyId')
                  : draft.protocol === 'dropbox' || draft.protocol === 'one-drive'
                    ? $t('ui.tokenAccountOptional')
                    : $t('ui.username')
              }}</span>
              <input
                v-model="draft.username"
                data-testid="remote-profile-username-input"
                type="text"
                autocomplete="username"
              />
            </label>
            <label v-if="policy.savePasswords">
              <span>{{
                draft.protocol === 's3'
                  ? $t('ui.secretAccessKey')
                  : draft.protocol === 'dropbox' || draft.protocol === 'one-drive'
                    ? $t('ui.oauthAccessToken')
                    : $t('ui.password')
              }}</span>
              <input
                v-model="draft.password"
                data-testid="remote-profile-password-input"
                type="password"
                autocomplete="current-password"
              />
            </label>
            <p
              v-else
              data-testid="policy-passwords-disabled"
            >
              {{ $t('ui.policyPasswordsDisabled') }}
            </p>
            <label class="credential-key">
              <span>{{ $t('ui.credentialKey') }}</span>
              <input
                v-model="draft.credentialKey"
                data-testid="remote-profile-credential-key-input"
                type="text"
              />
            </label>
          </div>
          <p class="secrets-hint">{{ $t('ui.secretsHint') }}</p>
          <p
            v-if="draft.protocol === 'dropbox' || draft.protocol === 'one-drive'"
            class="secrets-hint"
            data-testid="remote-oauth-token-hint"
          >
            {{ $t('ui.oauthTokenHint') }}
          </p>
          <div
            v-if="draft.protocol === 'dropbox' || draft.protocol === 'one-drive'"
            class="oauth-helper"
            data-testid="remote-oauth-helper"
          >
            <label>
              <span>{{ $t('ui.oauthClientId') }}</span>
              <input
                v-model="draft.oauthClientId"
                data-testid="remote-oauth-client-id"
                type="text"
                autocomplete="off"
                :placeholder="$t('ui.oauthClientIdHint')"
              />
            </label>
            <p class="secrets-hint">{{ $t('ui.oauthHelperHint') }}</p>
            <div class="oauth-helper-actions">
              <button
                type="button"
                data-testid="remote-oauth-open-browser"
                :disabled="!draft.oauthClientId.trim()"
                @click="openOAuthAuthorizeUrl"
              >
                {{ $t('ui.oauthOpenBrowser') }}
              </button>
            </div>
            <label>
              <span>{{ $t('ui.oauthPasteRedirect') }}</span>
              <input
                v-model="draft.oauthPaste"
                data-testid="remote-oauth-paste"
                type="text"
                autocomplete="off"
              />
            </label>
            <button
              type="button"
              data-testid="remote-oauth-apply-paste"
              :disabled="!draft.oauthPaste.trim()"
              @click="applyOAuthPaste"
            >
              {{ $t('ui.oauthApplyPaste') }}
            </button>
          </div>
          <p
            v-if="draft.uri"
            data-testid="remote-profile-uri"
          >
            {{ draft.uri }}
          </p>

          <p class="credential-summary">{{ credentialSummary }}</p>
          <p
            class="test-status"
            data-testid="remote-profile-test-status"
          >
            {{ testStatus }}
          </p>
        </section>
      </section>
    </section>

    <RemotePathBrowser
      v-if="showRemoteBrowser"
      :profile-id="draft.id || selectedProfileId"
      :profile-label="draft.name || draft.id || selectedProfileId"
      :initial-path="draft.rootPath || '/'"
      @select="applyBrowsedRootPath"
      @cancel="showRemoteBrowser = false"
    />

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.profileDetails') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.profiles') }}</dt>
              <dd>{{ profiles.length }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.protocol') }}</dt>
              <dd>{{ protocolLabel(draft.protocol) }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.credentialReference') }}</dt>
              <dd>{{ credentialSummary }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.status') }}</dt>
              <dd>{{ testStatus }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.remote-unavailable {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
}

.remote-profile-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.profile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 22px;
  line-height: 1.2;
}

h2 {
  font-size: 13px;
}

.profile-count {
  display: grid;
  min-width: 96px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.profile-count strong {
  font-size: 18px;
  line-height: 1;
}

.profile-count span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.profile-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  min-height: 380px;
}

.profile-list-panel,
.profile-detail-panel {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

button:hover:not(:disabled) {
  background: var(--app-surface-muted);
}

.profile-list {
  display: grid;
  gap: 4px;
}

.profile-row {
  display: grid;
  justify-items: start;
  gap: 3px;
  width: 100%;
  min-height: 54px;
  padding: 8px 10px;
  text-align: left;
}

.profile-row.active {
  border-color: #2563eb;
  background: rgb(37 99 235 / 0.1);
}

.profile-row span {
  font-weight: 700;
}

.profile-row small,
.test-status,
.credential-summary,
.secrets-hint {
  color: var(--app-text-muted);
  font-size: 12px;
}

.profile-summary,
.credential-summary,
.test-status {
  margin: 0;
  padding: 9px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  font-size: 12px;
}

.profile-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-row input {
  width: auto;
  height: auto;
}

.credential-key {
  grid-column: span 2;
}

label span {
  color: var(--app-text-muted);
  font-size: 12px;
}

input,
select {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
}

@media (width <= 820px) {
  .profile-header,
  .profile-workspace,
  .profile-form {
    grid-template-columns: 1fr;
  }

  .profile-header {
    display: grid;
  }

  .profile-count {
    text-align: left;
  }

  .credential-key {
    grid-column: auto;
  }
}

.oauth-helper {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.oauth-helper-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
