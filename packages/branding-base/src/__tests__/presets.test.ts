import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRANDING_PRESETS,
  DEFAULT_PRESET_ID,
  findPreset,
  getDefaultConfig,
} from '../presets';

describe('BRANDING_PRESETS', () => {
  it('contains at least 1 preset', () => {
    assert.ok(BRANDING_PRESETS.length >= 1);
  });

  it('every preset has an id, name, and colors', () => {
    for (const preset of BRANDING_PRESETS) {
      assert.ok(preset.id, `Preset missing id: ${JSON.stringify(preset)}`);
      assert.ok(preset.name, `Preset missing name: ${preset.id}`);
      assert.ok(preset.config.colors.primary, `Preset missing primary color: ${preset.id}`);
      assert.ok(preset.config.colors.secondary, `Preset missing secondary color: ${preset.id}`);
      assert.ok(preset.config.colors.accent, `Preset missing accent color: ${preset.id}`);
    }
  });

  it('includes the default preset', () => {
    const found = findPreset(DEFAULT_PRESET_ID);
    assert.ok(found, `Default preset "${DEFAULT_PRESET_ID}" not found`);
  });
});

describe('findPreset', () => {
  it('returns the correct preset by id', () => {
    const preset = findPreset('unicore-default');
    assert.ok(preset, 'Expected preset to be found');
    assert.equal(preset!.id, 'unicore-default');
  });

  it('returns undefined for unknown preset id', () => {
    assert.equal(findPreset('not-a-real-preset'), undefined);
  });
});

describe('getDefaultConfig', () => {
  it('uses "UniCore" as appName by default', () => {
    const config = getDefaultConfig();
    assert.equal(config.appName, 'UniCore');
  });

  it('uses provided appName', () => {
    const config = getDefaultConfig('Acme Dashboard');
    assert.equal(config.appName, 'Acme Dashboard');
  });

  it('has a valid updatedAt ISO timestamp', () => {
    const before = Date.now();
    const config = getDefaultConfig();
    const after = Date.now();
    assert.ok(config.updatedAt);
    const ts = new Date(config.updatedAt!).getTime();
    assert.ok(ts >= before && ts <= after);
  });

  it('includes primary, secondary, and accent colors', () => {
    const config = getDefaultConfig();
    assert.ok(config.colors.primary);
    assert.ok(config.colors.secondary);
    assert.ok(config.colors.accent);
  });
});
