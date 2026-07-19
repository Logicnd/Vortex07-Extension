/* Vortex07 cross-browser extension API (Chrome, Edge, Brave, Firefox). */
(function initVortex07ExtApi(global) {
  const ext = typeof browser !== "undefined" ? browser : chrome;

  function normalizeGetFallback(keys) {
    if (keys === null || keys === undefined) return {};
    if (typeof keys === "string") return { [keys]: undefined };
    if (Array.isArray(keys)) {
      const out = {};
      keys.forEach((key) => {
        out[key] = undefined;
      });
      return out;
    }
    if (typeof keys === "object") return { ...keys };
    return {};
  }

  function runStorageMethod(method, area, arg) {
    return new Promise((resolve) => {
      try {
        const store = ext.storage?.[area];
        const fn = store?.[method];
        if (typeof fn !== "function") {
          resolve(method === "get" ? normalizeGetFallback(arg) : undefined);
          return;
        }

        const bound = fn.bind(store);
        let pending;

        try {
          pending = bound(arg);
        } catch (_err) {
          pending = null;
        }

        if (pending && typeof pending.then === "function") {
          pending
            .then((value) => {
              if (method === "get") {
                resolve(value ?? normalizeGetFallback(arg));
                return;
              }
              resolve(value);
            })
            .catch(() => {
              resolve(method === "get" ? normalizeGetFallback(arg) : undefined);
            });
          return;
        }

        if (method === "get") {
          bound(arg, (data) => {
            if (ext.runtime?.lastError) {
              resolve(normalizeGetFallback(arg));
              return;
            }
            resolve(data ?? normalizeGetFallback(arg));
          });
          return;
        }

        bound(arg, () => resolve());
      } catch (_err) {
        resolve(method === "get" ? normalizeGetFallback(arg) : undefined);
      }
    });
  }

  function storageGet(area, keys) {
    return runStorageMethod("get", area, keys);
  }

  function storageSet(area, items) {
    return runStorageMethod("set", area, items);
  }

  function storageRemove(area, keys) {
    return runStorageMethod("remove", area, keys);
  }

  function isContextAlive() {
    try {
      if (ext.runtime?.id) return true;
      if (typeof ext.runtime?.getURL === "function") {
        ext.runtime.getURL("");
        return true;
      }
    } catch (_err) {
      return false;
    }
    return false;
  }

  function onStorageChanged(listener) {
    ext.storage?.onChanged?.addListener(listener);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        const pending = ext.runtime.sendMessage(message);
        if (pending && typeof pending.then === "function") {
          pending.then(resolve).catch(reject);
          return;
        }
      } catch (_err) {
        /* fall through to callback API */
      }

      try {
        ext.runtime.sendMessage(message, (response) => {
          const err = ext.runtime?.lastError;
          if (err) {
            reject(new Error(err.message || String(err)));
            return;
          }
          resolve(response);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function runTabsMethod(method, ...args) {
    return new Promise((resolve) => {
      try {
        const fn = ext.tabs?.[method];
        if (typeof fn !== "function") {
          resolve(method === "query" ? [] : null);
          return;
        }

        const bound = fn.bind(ext.tabs);
        let pending;

        try {
          pending = bound(...args);
        } catch (_err) {
          pending = null;
        }

        if (pending && typeof pending.then === "function") {
          pending
            .then((value) => resolve(value))
            .catch(() => resolve(method === "query" ? [] : null));
          return;
        }

        bound(...args, (value) => {
          if (ext.runtime?.lastError) {
            resolve(method === "query" ? [] : null);
            return;
          }
          resolve(value ?? (method === "query" ? [] : null));
        });
      } catch (_err) {
        resolve(method === "query" ? [] : null);
      }
    });
  }

  global.Vortex07Ext = {
    api: ext,
    storageGet,
    storageSet,
    storageRemove,
    isContextAlive,
    onStorageChanged,
    sendRuntimeMessage,
    getURL: (path) => ext.runtime.getURL(path),
    getManifest: () => ext.runtime.getManifest(),
    queryTabs: (queryInfo) => runTabsMethod("query", queryInfo),
    updateTab: (tabId, props) => runTabsMethod("update", tabId, props),
    createTab: (props) => runTabsMethod("create", props),
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
