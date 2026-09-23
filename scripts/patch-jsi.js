// Patch di RuntimeScheduler.h (expo-modules-jsi): rimuove l'attributo
// SWIFT_RETURNS_RETAINED che fa fallire la compilazione Swift
// (bug upstream: expo/expo#49214, expo/expo#49426).
// Idempotente e non-fatal: se il file è già patchato o assente, esce in pace.
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI-Cxx',
  'include',
  'RuntimeScheduler.h'
);

try {
  const src = fs.readFileSync(target, 'utf8');
  const out = src.split('SWIFT_RETURNS_RETAINED').join('');
  if (out !== src) {
    fs.writeFileSync(target, out);
    console.log('[patch-jsi] RuntimeScheduler.h patchato');
  }
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.warn('[patch-jsi] skip: ' + e.message);
  }
}
