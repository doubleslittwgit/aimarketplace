/**
 * ツール本体としてアップロードを許可するファイル形式。
 *
 * 【なぜ必要か】
 * 以前は制限が一切無く、サムネイル用の画像を誤って本体として
 * アップロードできてしまう状態だった。
 *
 * 【方針】
 * プラグインの世界は形式が非常に多様なので、「ZIPだけ」のように
 * 絞りすぎると正当な出品ができなくなる。逆に全部を列挙しきることも
 * 難しい。そのため「主要な配布形式を許可しつつ、画像・動画など
 * 明らかにツール本体ではないものを弾く」という方針にしている。
 */

/** アーカイブ・インストーラ（OS別の一般的な配布形式） */
const ARCHIVE_AND_INSTALLER = [
  ".zip", ".7z", ".rar", ".tar", ".gz", ".tgz",
  ".exe", ".msi",              // Windows
  ".dmg", ".pkg",              // macOS
  ".appimage", ".deb", ".rpm", // Linux
];

/** スクリプト・実行可能な形式 */
const SCRIPT = [".py", ".js", ".jsx", ".jsxbin", ".jar", ".sh", ".bat", ".ps1"];

/** 映像・3DCG系ソフトのプラグイン・プリセット */
const CREATIVE_PLUGIN = [
  ".aex", ".ffx",                  // After Effects
  ".c4d", ".lib4d",                // Cinema 4D
  ".prfpset", ".prproj",           // Premiere Pro
  ".tox", ".toe",                  // TouchDesigner
  ".blend",                        // Blender
];

/** DAW（音楽制作）系のプラグイン・プリセット */
const AUDIO_PLUGIN = [
  ".vst", ".vst3", ".dll", ".component", ".aaxplugin", ".clap", // 共通規格
  ".adg", ".adv", ".alp", ".amxd",   // Ableton Live
  ".flp", ".fst", ".nfp",            // FL Studio
  ".pst", ".cst",                    // Logic Pro
];

export const ALLOWED_TOOL_FILE_EXTENSIONS = [
  ...ARCHIVE_AND_INSTALLER,
  ...SCRIPT,
  ...CREATIVE_PLUGIN,
  ...AUDIO_PLUGIN,
];

/** <input accept="..."> にそのまま渡せる文字列 */
export const TOOL_FILE_ACCEPT = ALLOWED_TOOL_FILE_EXTENSIONS.join(",");

/**
 * ファイル名が、許可された形式かどうかを判定する。
 *
 * acceptはあくまでファイル選択画面での絞り込みに過ぎず、
 * ドラッグ&ドロップや選択画面での手動切り替えで回避できてしまうため、
 * サーバー側でもこの関数で必ず検証する。
 */
export function isAllowedToolFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_TOOL_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
