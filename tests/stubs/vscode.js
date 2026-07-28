// Minimal stand-in for the `vscode` module.
//
// activate() can only be exercised inside a running editor, which is exactly
// why nothing had ever run it. This records what the extension asks of the API
// so the activation path — integrity check, command registration, the
// markdown-it hook that delivers custom palettes — is covered by the suite
// rather than by hoping.
const state = {
  errors: [],
  infos: [],
  warnings: [],
  commands: new Map(),
  executed: [],
  configListeners: [],
  subscriptions: [],
  config: {},
};

module.exports = {
  __state: state,
  __reset() {
    state.errors.length = 0;
    state.infos.length = 0;
    state.warnings.length = 0;
    state.commands.clear();
    state.executed.length = 0;
    state.configListeners.length = 0;
    state.subscriptions.length = 0;
    state.config = {};
  },
  window: {
    showErrorMessage: (m) => state.errors.push(m),
    showInformationMessage: (m) => state.infos.push(m),
    showWarningMessage: (m) => state.warnings.push(m),
  },
  commands: {
    registerCommand: (id, fn) => {
      state.commands.set(id, fn);
      return { dispose() {} };
    },
    executeCommand: (id) => {
      state.executed.push(id);
      return Promise.resolve();
    },
  },
  workspace: {
    getConfiguration: (section) => ({
      get: (key) => state.config[`${section}.${key}`],
    }),
    onDidChangeConfiguration: (fn) => {
      state.configListeners.push(fn);
      return { dispose() {} };
    },
  },
};
