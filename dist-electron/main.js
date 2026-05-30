import { createRequire as e } from "node:module";
import { fileURLToPath as t } from "node:url";
import n from "node:path";
//#region electron/main.ts
var { app: r, BrowserWindow: i, session: a, ipcMain: o, shell: s } = e(import.meta.url)("electron"), c = n.dirname(t(import.meta.url)), l = n.join(c, "../dist"), u = n.join(c, "preload.mjs");
function d() {
	a.defaultSession.webRequest.onHeadersReceived((e, t) => {
		t({ responseHeaders: {
			...e.responseHeaders,
			"Cross-Origin-Opener-Policy": ["same-origin"],
			"Cross-Origin-Embedder-Policy": ["require-corp"]
		} });
	});
}
function f() {
	let e = new i({
		width: 1400,
		height: 860,
		minWidth: 960,
		minHeight: 600,
		title: "Guitar Pedalboard",
		backgroundColor: "#121212",
		webPreferences: {
			preload: u,
			contextIsolation: !0,
			nodeIntegration: !1,
			sandbox: !1
		}
	});
	return e.webContents.setWindowOpenHandler(({ url: e }) => (s.openExternal(e), { action: "deny" })), process.env.VITE_DEV_SERVER_URL ? (e.loadURL(process.env.VITE_DEV_SERVER_URL), e.webContents.openDevTools()) : e.loadFile(n.join(l, "index.html")), e;
}
o.handle("app:version", () => r.getVersion()), o.handle("app:platform", () => process.platform), r.whenReady().then(() => {
	d(), f(), r.on("activate", () => {
		i.getAllWindows().length === 0 && f();
	});
}), r.on("window-all-closed", () => {
	process.platform !== "darwin" && r.quit();
});
//#endregion
