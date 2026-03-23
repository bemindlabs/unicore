import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { PLUGINS_BASE_DIR, PluginArtifactService } from './plugin-artifact.service';

// ─── fs mock ──────────────────────────────────────────────────────────────────
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rm: jest.fn(),
  },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsMock = (require('fs') as { promises: { mkdir: jest.Mock; writeFile: jest.Mock; unlink: jest.Mock; rm: jest.Mock } }).promises;

// ─── child_process mock ───────────────────────────────────────────────────────
jest.mock('child_process', () => ({ exec: jest.fn() }));
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: () => jest.requireMock('util').__execAsync,
  __execAsync: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const execAsyncMock = (require('util') as { __execAsync: jest.Mock }).__execAsync;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeBuffer = (content = 'hello-plugin') => Buffer.from(content);

const sha256hex = (buf: Buffer) =>
  createHash('sha256').update(buf).digest('hex');

const makeFetchResponse = (opts: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: Buffer;
  contentType?: string;
}) => {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    body = makeBuffer(),
    contentType = 'application/zip',
  } = opts;
  return {
    ok,
    status,
    statusText,
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    arrayBuffer: jest.fn().mockResolvedValue(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
  } as unknown as Response;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PluginArtifactService', () => {
  let service: PluginArtifactService;

  beforeEach(async () => {
    jest.clearAllMocks();
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
    fsMock.unlink.mockResolvedValue(undefined);
    fsMock.rm.mockResolvedValue(undefined);
    execAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginArtifactService],
    }).compile();

    service = module.get<PluginArtifactService>(PluginArtifactService);
  });

  // ─── download ───────────────────────────────────────────────────────────────

  describe('download', () => {
    it('returns buffer and metadata on success', async () => {
      const body = makeBuffer('zip-content');
      global.fetch = jest
        .fn()
        .mockResolvedValue(makeFetchResponse({ body, contentType: 'application/zip' }));

      const result = await service.download('https://example.com/plugin.zip');

      expect(result.size).toBe(body.length);
      expect(result.contentType).toBe('application/zip');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('throws InternalServerErrorException on non-2xx response', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          makeFetchResponse({ ok: false, status: 404, statusText: 'Not Found' }),
        );

      await expect(
        service.download('https://example.com/missing.zip'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.download('https://example.com/plugin.zip'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── verify ─────────────────────────────────────────────────────────────────

  describe('verify', () => {
    it('passes when checksum matches', () => {
      const buf = makeBuffer('test-content');
      expect(() => service.verify(buf, sha256hex(buf))).not.toThrow();
    });

    it('passes when checksum has "sha256:" prefix', () => {
      const buf = makeBuffer('test-content');
      expect(() => service.verify(buf, `sha256:${sha256hex(buf)}`)).not.toThrow();
    });

    it('throws BadRequestException on mismatch', () => {
      const buf = makeBuffer('test-content');
      expect(() => service.verify(buf, 'deadbeef')).toThrow(BadRequestException);
    });

    it('is case-insensitive for hex string', () => {
      const buf = makeBuffer('case-test');
      const upper = sha256hex(buf).toUpperCase();
      expect(() => service.verify(buf, upper)).not.toThrow();
    });
  });

  // ─── extract ────────────────────────────────────────────────────────────────

  describe('extract', () => {
    it('creates targetDir, writes temp file, and calls unzip', async () => {
      const buf = makeBuffer();
      await service.extract(buf, '/app/plugins/my-plugin/1.0.0');

      expect(fsMock.mkdir).toHaveBeenCalledWith('/app/plugins/my-plugin/1.0.0', {
        recursive: true,
      });
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('unicore-plugin-'),
        buf,
      );
      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringMatching(/unzip -o ".+" -d "\/app\/plugins\/my-plugin\/1\.0\.0"/),
      );
    });

    it('cleans up the temp file even when unzip fails', async () => {
      execAsyncMock.mockRejectedValue(new Error('unzip: command failed'));

      await expect(
        service.extract(makeBuffer(), '/app/plugins/bad/1.0.0'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(fsMock.unlink).toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when unzip fails', async () => {
      execAsyncMock.mockRejectedValue(new Error('bad zip'));

      await expect(
        service.extract(makeBuffer(), '/app/plugins/x/1.0.0'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── cleanup ────────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('removes the plugin directory', async () => {
      await service.cleanup('my-plugin');

      expect(fsMock.rm).toHaveBeenCalledWith(
        `${PLUGINS_BASE_DIR}/my-plugin`,
        { recursive: true, force: true },
      );
    });

    it('resolves quietly when directory does not exist (force: true)', async () => {
      fsMock.rm.mockResolvedValue(undefined); // force: true swallows ENOENT
      await expect(service.cleanup('ghost-plugin')).resolves.toBeUndefined();
    });

    it('logs a warning instead of throwing when rm fails unexpectedly', async () => {
      fsMock.rm.mockRejectedValue(new Error('EPERM'));
      await expect(service.cleanup('locked-plugin')).resolves.toBeUndefined();
    });
  });

  // ─── getInstallPath ─────────────────────────────────────────────────────────

  describe('getInstallPath', () => {
    it('returns /app/plugins/{pluginId}/{version}', () => {
      expect(service.getInstallPath('my-plugin', '1.2.3')).toBe(
        '/app/plugins/my-plugin/1.2.3',
      );
    });

    it('handles nested version strings', () => {
      expect(service.getInstallPath('acme-crm', 'v2.0.0-beta.1')).toBe(
        '/app/plugins/acme-crm/v2.0.0-beta.1',
      );
    });
  });
});
