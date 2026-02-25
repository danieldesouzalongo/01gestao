/**
 * Controle de estado da UI — painéis e navegação.
 * Mantém estado único para evitar bugs e lógica duplicada.
 */

const UI = {
    activePanel: null, // 'settings' | null

    isSettingsOpen() {
        return this.activePanel === 'settings';
    },

    openSettings() {
        if (this.activePanel === 'settings') return;
        this.activePanel = 'settings';
        const overlay = document.getElementById('avv-settings-overlay');
        const panel = document.getElementById('avv-settings-panel');
        if (overlay) {
            overlay.classList.add('avv-settings-overlay-visible');
            overlay.setAttribute('aria-hidden', 'false');
        }
        if (panel) {
            panel.classList.add('avv-settings-panel-visible');
            panel.setAttribute('aria-hidden', 'false');
        }
        document.body.classList.add('avv-settings-open');
    },

    closeSettings() {
        if (this.activePanel !== 'settings') return;
        this.activePanel = null;
        const overlay = document.getElementById('avv-settings-overlay');
        const panel = document.getElementById('avv-settings-panel');
        if (overlay) {
            overlay.classList.remove('avv-settings-overlay-visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
        if (panel) {
            panel.classList.remove('avv-settings-panel-visible');
            panel.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('avv-settings-open');
    },

    toggleSettings() {
        if (this.isSettingsOpen()) {
            this.closeSettings();
        } else {
            this.openSettings();
        }
    }
};

export { UI };
