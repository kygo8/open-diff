<script setup lang="ts">
import { computed, ref } from 'vue'

type RemoteProtocol =
  | 'ftp'
  | 'ftps'
  | 'sftp'
  | 'web-dav'
  | 's3'
  | 'dropbox'
  | 'one-drive'
  | 'subversion'
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
  credentialKind: CredentialReferenceKind
  credentialKey: string
}

const builtInProfiles: RemoteProfile[] = [
  {
    id: 'prod-sftp',
    name: 'Production SFTP',
    protocol: 'sftp',
    endpoint: {
      host: 'files.example.com',
      port: 22,
      rootPath: '/deployments',
    },
    credentialRef: {
      kind: 'system-keychain',
      key: 'prod-sftp-main',
    },
  },
  {
    id: 'team-webdav',
    name: 'Team WebDAV',
    protocol: 'web-dav',
    endpoint: {
      host: 'dav.example.com',
      port: 443,
      rootPath: '/shared/releases',
    },
    credentialRef: {
      kind: 'environment',
      key: 'OPEN_DIFF_WEBDAV_CREDENTIAL',
    },
  },
]

const profiles = ref<RemoteProfile[]>(builtInProfiles.map((profile) => cloneProfile(profile)))
const selectedProfileId = ref(profiles.value[0]?.id ?? '')
const draft = ref<RemoteProfileDraft>(toDraft(profiles.value[0] ?? emptyProfile()))
const testStatus = ref('No connection test run')

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

function selectProfile(profileId: string): void {
  const profile = profiles.value.find((item) => item.id === profileId)

  if (!profile) {
    return
  }

  selectedProfileId.value = profile.id
  draft.value = toDraft(profile)
  testStatus.value = 'No connection test run'
}

function createNewProfile(): void {
  selectedProfileId.value = ''
  draft.value = toDraft(emptyProfile())
  testStatus.value = 'No connection test run'
}

function saveProfile(): void {
  const nextProfile = fromDraft(draft.value)
  const existingIndex = profiles.value.findIndex((profile) => profile.id === nextProfile.id)

  if (existingIndex >= 0) {
    profiles.value.splice(existingIndex, 1, nextProfile)
  } else {
    profiles.value.push(nextProfile)
  }

  selectedProfileId.value = nextProfile.id
  draft.value = toDraft(nextProfile)
}

function deleteProfile(): void {
  if (!selectedProfileId.value) {
    return
  }

  profiles.value = profiles.value.filter((profile) => profile.id !== selectedProfileId.value)

  if (profiles.value.length === 0) {
    createNewProfile()

    return
  }

  const nextProfile = sortedProfiles.value[0]

  selectedProfileId.value = nextProfile.id
  draft.value = toDraft(nextProfile)
}

function testProfileConnection(): void {
  const host = draft.value.host.trim()

  testStatus.value = host
    ? `Connection check queued for ${host}`
    : 'Connection check requires a host'
}

function toDraft(profile: RemoteProfile): RemoteProfileDraft {
  return {
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    host: profile.endpoint.host,
    port: profile.endpoint.port,
    rootPath: profile.endpoint.rootPath,
    credentialKind: profile.credentialRef.kind,
    credentialKey: profile.credentialRef.key,
  }
}

function fromDraft(source: RemoteProfileDraft): RemoteProfile {
  const name = valueOrFallback(source.name, 'Untitled Profile')

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
  return {
    id: '',
    name: '',
    protocol: 'sftp',
    endpoint: {
      host: '',
      port: 22,
      rootPath: '/',
    },
    credentialRef: {
      kind: 'system-keychain',
      key: '',
    },
  }
}

function cloneProfile(profile: RemoteProfile): RemoteProfile {
  return JSON.parse(JSON.stringify(profile)) as RemoteProfile
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

function protocolLabel(protocol: RemoteProtocol): string {
  const labels: Record<RemoteProtocol, string> = {
    ftp: 'FTP',
    ftps: 'FTPS',
    sftp: 'SFTP',
    'web-dav': 'WebDAV',
    s3: 'S3',
    dropbox: 'Dropbox',
    'one-drive': 'OneDrive',
    subversion: 'Subversion',
  }

  return labels[protocol]
}

function credentialKindLabel(kind: CredentialReferenceKind): string {
  const labels: Record<CredentialReferenceKind, string> = {
    'system-keychain': 'System keychain',
    environment: 'Environment variable',
    'profile-store': 'Profile store',
  }

  return labels[kind]
}
</script>

<template>
  <section class="remote-profile-view">
    <header class="profile-header">
      <div>
        <p class="eyebrow">Settings</p>
        <h1>Remote Profiles</h1>
      </div>
      <div class="profile-count">
        <strong>{{ profiles.length }}</strong>
        <span>profiles</span>
      </div>
    </header>

    <section class="profile-workspace">
      <aside class="profile-list-panel">
        <div class="panel-title">
          <h2>Profiles</h2>
          <button
            type="button"
            data-testid="new-remote-profile"
            @click="createNewProfile"
          >
            New
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
          <h2>Profile Details</h2>
          <div class="profile-actions">
            <button
              type="button"
              data-testid="test-remote-profile"
              @click="testProfileConnection"
            >
              Test
            </button>
            <button
              type="button"
              data-testid="delete-remote-profile"
              :disabled="!selectedProfile"
              @click="deleteProfile"
            >
              Delete
            </button>
            <button
              type="button"
              data-testid="save-remote-profile"
              @click="saveProfile"
            >
              Save
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
            <span>Name</span>
            <input
              v-model="draft.name"
              data-testid="remote-profile-name-input"
              type="text"
            />
          </label>
          <label>
            <span>Protocol</span>
            <select
              v-model="draft.protocol"
              data-testid="remote-profile-protocol-select"
            >
              <option value="ftp">FTP</option>
              <option value="ftps">FTPS</option>
              <option value="sftp">SFTP</option>
              <option value="web-dav">WebDAV</option>
              <option value="s3">S3</option>
              <option value="dropbox">Dropbox</option>
              <option value="one-drive">OneDrive</option>
              <option value="subversion">Subversion</option>
            </select>
          </label>
          <label>
            <span>Host</span>
            <input
              v-model="draft.host"
              data-testid="remote-profile-host-input"
              type="text"
            />
          </label>
          <label>
            <span>Port</span>
            <input
              v-model.number="draft.port"
              data-testid="remote-profile-port-input"
              type="number"
              min="1"
              max="65535"
            />
          </label>
          <label>
            <span>Root Path</span>
            <input
              v-model="draft.rootPath"
              data-testid="remote-profile-root-input"
              type="text"
            />
          </label>
          <label>
            <span>Credential reference</span>
            <select
              v-model="draft.credentialKind"
              data-testid="remote-profile-credential-kind-select"
            >
              <option value="system-keychain">System keychain</option>
              <option value="environment">Environment variable</option>
              <option value="profile-store">Profile store</option>
            </select>
          </label>
          <label class="credential-key">
            <span>Credential key</span>
            <input
              v-model="draft.credentialKey"
              data-testid="remote-profile-credential-key-input"
              type="text"
            />
          </label>
        </div>

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
</template>

<style scoped>
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
.credential-summary {
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
</style>
