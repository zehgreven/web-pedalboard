<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { usePluginFolders } from '@/composables/usePluginFolders'

const emit = defineEmits<{ close: [] }>()

const { folders, load, addFolder, removeFolder, requestPermission } = usePluginFolders()

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

onMounted(load)

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal-backdrop" @click="onBackdropClick">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <!-- Header -->
      <div class="modal__header">
        <span id="settings-title" class="modal__title">Settings</span>
        <button class="modal__close" aria-label="Close settings" @click="$emit('close')">✕</button>
      </div>

      <!-- Body -->
      <div class="modal__body">

        <!-- Plugin Folders section -->
        <section class="setting-section">
          <div class="setting-section__header">
            <div>
              <p class="setting-section__label">Plugin Folders</p>
              <p class="setting-section__desc">
                Folders where your <code>.vst</code>, <code>.vst3</code>,
                <code>.lv2</code> and <code>LADSPA</code> plugins are installed.
              </p>
            </div>
            <button class="btn-add" @click="addFolder">+ Add folder</button>
          </div>

          <div class="folder-list">
            <!-- Empty state -->
            <p v-if="folders.length === 0" class="folder-list__empty">
              No folders configured yet.
            </p>

            <!-- Folder rows -->
            <div
              v-for="folder in folders"
              :key="folder.id"
              class="folder-row"
              :class="`folder-row--${folder.permission}`"
            >
              <span class="folder-row__icon" aria-hidden="true">📁</span>
              <!-- In Electron, show full path; in browser show just name -->
              <span class="folder-row__name" :title="folder.path ?? folder.name">
                {{ folder.path ?? folder.name }}
              </span>

              <!-- Permission badge — not shown in Electron (always granted via fs) -->
              <template v-if="!isElectron">
                <button
                  v-if="folder.permission !== 'granted'"
                  class="folder-row__badge folder-row__badge--warn"
                  :title="folder.permission === 'denied' ? 'Permission denied' : 'Click to re-grant access'"
                  @click="requestPermission(folder)"
                >
                  {{ folder.permission === 'denied' ? 'denied' : 'grant access' }}
                </button>
                <span
                  v-else
                  class="folder-row__badge folder-row__badge--ok"
                  title="Access granted"
                >
                  granted
                </span>
              </template>

              <button
                class="folder-row__remove"
                aria-label="Remove folder"
                @click="removeFolder(folder.id)"
              >
                ✕
              </button>
            </div>
          </div>

          <p class="setting-section__note">
            <template v-if="isElectron">
              As pastas são salvas permanentemente. Plugins listados na sidebar são identificados
              por nome e formato — a execução nativa requer integração com host de plugins (futuro).
            </template>
            <template v-else>
              ⚠ O browser não executa nativamente VST/VST3, LV2 ou LADSPA.
              A permissão de leitura precisa ser re-concedida a cada visita do browser.
            </template>
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Backdrop ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  animation: fade-in 0.15s ease;
}

@keyframes fade-in {
  from { opacity: 0 }
  to   { opacity: 1 }
}

/* ── Modal box ── */
.modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  animation: slide-in 0.15s ease;
}

@keyframes slide-in {
  from { transform: translateY(-12px); opacity: 0 }
  to   { transform: translateY(0);     opacity: 1 }
}

/* ── Header ── */
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.modal__close {
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s;
}

.modal__close:hover {
  color: var(--text-1);
}

/* ── Body ── */
.modal__body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Setting section ── */
.setting-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.setting-section__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 2px;
}

.setting-section__desc {
  font-size: 12px;
  color: var(--text-3);
  margin: 0;
}

.setting-section__desc code {
  font-family: monospace;
  background: var(--bg-section);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

.setting-section__note {
  font-size: 11px;
  color: var(--text-4);
  margin: 0;
}

/* ── Add button ── */
.btn-add {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 5px;
  border: 1px solid var(--border-sub);
  background: var(--bg-input);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s;
}

.btn-add:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Folder list ── */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 1px solid var(--border-sub);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-section);
}

.folder-list__empty {
  padding: 14px 16px;
  font-size: 12px;
  color: var(--text-4);
  margin: 0;
}

/* ── Folder row ── */
.folder-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-faint);
  font-size: 13px;
  transition: background 0.1s;
}

.folder-row:last-child {
  border-bottom: none;
}

.folder-row:hover {
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-card));
}

.folder-row__icon {
  font-size: 14px;
  flex-shrink: 0;
}

.folder-row__name {
  flex: 1;
  color: var(--text-1);
  font-family: monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Permission badge */
.folder-row__badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  cursor: default;
  border: none;
}

.folder-row__badge--ok {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}

.folder-row__badge--warn {
  background: color-mix(in srgb, #f39c12 15%, transparent);
  color: #f39c12;
  cursor: pointer;
}

.folder-row__badge--warn:hover {
  background: color-mix(in srgb, #f39c12 25%, transparent);
}

/* Remove button */
.folder-row__remove {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-4);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}

.folder-row__remove:hover {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}
</style>
