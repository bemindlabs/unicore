import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BrandingService, MemoryBrandingStorage } from '../service';
import { getDefaultConfig } from '../presets';

describe('MemoryBrandingStorage', () => {
  it('load() returns null when empty', async () => {
    const storage = new MemoryBrandingStorage();
    assert.equal(await storage.load(), null);
  });

  it('save() and load() round-trips data', async () => {
    const storage = new MemoryBrandingStorage();
    const cfg = getDefaultConfig('AcmeCorp');
    await storage.save(cfg);
    const loaded = await storage.load();
    assert.deepEqual(loaded, cfg);
  });

  it('clear() resets to null', async () => {
    const storage = new MemoryBrandingStorage();
    await storage.save(getDefaultConfig());
    await storage.clear();
    assert.equal(await storage.load(), null);
  });
});

describe('BrandingService', () => {
  function makeService(opts?: { defaultAppName?: string }): BrandingService {
    return new BrandingService({
      storage: new MemoryBrandingStorage(),
      ...opts,
    });
  }

  it('load() returns default config when nothing is stored', async () => {
    const service = makeService({ defaultAppName: 'MyApp' });
    const config = await service.load();
    assert.equal(config.appName, 'MyApp');
    assert.ok(config.colors.primary);
  });

  it('load() caches result on subsequent calls', async () => {
    const storage = new MemoryBrandingStorage();
    let loadCount = 0;
    const originalLoad = storage.load.bind(storage);
    storage.load = async () => {
      loadCount++;
      return originalLoad();
    };
    const service = new BrandingService({ storage });
    await service.load();
    await service.load();
    assert.equal(loadCount, 1);
  });

  it('save() stamps updatedAt', async () => {
    const service = makeService();
    const before = Date.now();
    const cfg = getDefaultConfig('Stamped');
    const saved = await service.save(cfg);
    const after = Date.now();
    assert.ok(saved.updatedAt);
    const ts = new Date(saved.updatedAt!).getTime();
    assert.ok(ts >= before && ts <= after);
  });

  it('patch() merges colors deeply', async () => {
    const service = makeService();
    const original = await service.load();
    const patched = await service.patch({
      colors: { primary: '#ff0000' },
    });
    assert.equal(patched.colors.primary, '#ff0000');
    assert.equal(patched.colors.secondary, original.colors.secondary);
  });

  it('patch() updates top-level fields', async () => {
    const service = makeService();
    const patched = await service.patch({ appName: 'NewName' });
    assert.equal(patched.appName, 'NewName');
  });

  it('reset() restores defaults and preserves appName', async () => {
    const service = makeService({ defaultAppName: 'MyPlatform' });
    await service.load();
    await service.patch({ appName: 'CustomName', colors: { primary: '#abcdef' } });
    const reset = await service.reset();
    assert.equal(reset.appName, 'CustomName');
    assert.notEqual(reset.colors.primary, '#abcdef');
  });

  it('applyPreset() applies preset colors but keeps appName', async () => {
    const service = makeService();
    await service.patch({ appName: 'MyBrand' });
    const result = await service.applyPreset('zinc-light');
    assert.equal(result.appName, 'MyBrand');
    assert.equal(result.colors.primary, '#6366f1'); // zinc-light primary
  });

  it('applyPreset() throws on unknown preset', async () => {
    const service = makeService();
    await assert.rejects(
      () => service.applyPreset('does-not-exist'),
      { message: 'Branding preset "does-not-exist" not found.' },
    );
  });

  it('invalidateCache() forces reload from storage on next load()', async () => {
    const storage = new MemoryBrandingStorage();
    let loadCount = 0;
    const originalLoad = storage.load.bind(storage);
    storage.load = async () => {
      loadCount++;
      return originalLoad();
    };
    const service = new BrandingService({ storage });
    await service.load();
    service.invalidateCache();
    await service.load();
    assert.equal(loadCount, 2);
  });
});
