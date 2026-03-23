import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import * as os from 'os';

const execAsync = promisify(exec);

// Map logical service names to container names
const SERVICE_CONTAINERS: Record<string, string> = {
  'api-gateway': 'unicores-unicore-api-gateway-1',
  'erp': 'unicores-unicore-erp-1',
  'dashboard': 'unicores-unicore-dashboard-1',
  'ai-engine': 'unicores-unicore-ai-engine-1',
  'rag': 'unicores-unicore-rag-1',
  'openclaw': 'unicores-unicore-openclaw-gateway-1',
  'workflow': 'unicores-unicore-workflow-1',
  'bootstrap': 'unicores-unicore-bootstrap-1',
  'nginx': 'unicores-unicore-nginx-1',
  'kafka': 'unicores-unicore-kafka-1',
  'redis': 'unicores-unicore-redis-1',
  'postgres': 'unicores-unicore-postgres-1',
  'vectordb': 'unicores-unicore-vectordb-1',
  'license-api': 'unicores-unicore-license-api-1',
};

const ALLOWED_SERVICES = new Set(Object.keys(SERVICE_CONTAINERS));

async function fetchRedisInfo(
  host: string,
  port: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = '';
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Redis connection timed out'));
    }, 5000);

    socket.connect(port, host, () => {
      socket.write('*1\r\n$4\r\nINFO\r\n');
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      // INFO response ends with \r\n
      if (buffer.includes('\r\n\r\n') || buffer.length > 8192) {
        clearTimeout(timeout);
        socket.destroy();
        // Strip RESP bulk string header (first line like "$3456\r\n")
        const crlf = buffer.indexOf('\r\n');
        const info = crlf >= 0 ? buffer.slice(crlf + 2) : buffer;
        resolve(info.replace(/\r\n/g, '\n').trim());
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function safeDockerLogs(
  container: string,
  lines: number,
): Promise<string> {
  const safeContainer = container.replace(/[^a-z0-9_\-]/g, '');
  const safeLines = Math.min(Math.max(1, lines), 500);
  const { stdout, stderr } = await execAsync(
    `docker logs --tail ${safeLines} ${safeContainer} 2>&1`,
    { timeout: 15000 },
  );
  return (stdout + stderr).trim();
}

async function safeDockerRestart(container: string): Promise<string> {
  const safeContainer = container.replace(/[^a-z0-9_\-]/g, '');
  const { stdout } = await execAsync(
    `docker restart ${safeContainer}`,
    { timeout: 30000 },
  );
  return stdout.trim() || safeContainer;
}

@Roles('OWNER')
@Controller('api/v1/admin/system')
export class SystemCommandsController {
  private readonly logger = new Logger(SystemCommandsController.name);

  // ─── /status ────────────────────────────────────────────────────────────────
  @Get('status')
  async status() {
    const now = new Date().toISOString();
    const services: Array<{
      name: string;
      status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      latencyMs?: number;
      lastCheckedAt: string;
      errorMessage?: string;
    }> = [];

    const check = async (name: string, url: string) => {
      const t = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        services.push({
          name,
          status: res.ok ? 'HEALTHY' : 'DEGRADED',
          latencyMs: Date.now() - t,
          lastCheckedAt: now,
        });
      } catch (err: any) {
        services.push({
          name,
          status: 'UNHEALTHY',
          latencyMs: Date.now() - t,
          lastCheckedAt: now,
          errorMessage: err?.message ?? 'Connection failed',
        });
      }
    };

    const erpHost = process.env.ERP_SERVICE_HOST ?? 'erp';
    const erpPort = process.env.ERP_SERVICE_PORT ?? '4100';
    const ocHost = process.env.OPENCLAW_SERVICE_HOST ?? 'openclaw-gateway';
    const ocPort = process.env.OPENCLAW_SERVICE_PORT ?? '18790';
    const ragHost = process.env.RAG_SERVICE_HOST ?? 'rag';
    const ragPort = process.env.RAG_SERVICE_PORT ?? '4300';
    const aiHost = process.env.AI_ENGINE_SERVICE_HOST ?? 'ai-engine';
    const aiPort = process.env.AI_ENGINE_SERVICE_PORT ?? '4200';

    await Promise.all([
      check('API Gateway', 'http://localhost:4000/health'),
      check('ERP Service', `http://${erpHost}:${erpPort}/api/v1/health`),
      check('OpenClaw Gateway', `http://${ocHost}:${ocPort}/health`),
      check('RAG Service', `http://${ragHost}:${ragPort}/health`),
      check('AI Engine', `http://${aiHost}:${aiPort}/api/v1/llm/health`),
    ]);

    const overall = services.every(s => s.status === 'HEALTHY')
      ? 'HEALTHY'
      : services.some(s => s.status === 'UNHEALTHY')
        ? 'DEGRADED'
        : 'DEGRADED';

    const uptimeSec = Math.floor(process.uptime());
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();

    return {
      overallStatus: overall,
      services,
      system: {
        hostname: os.hostname(),
        uptimeSeconds: uptimeSec,
        cpuCores: cpus.length,
        cpuLoadPercent: Math.round((os.loadavg()[0] / cpus.length) * 100),
        memoryTotalMb: Math.round(totalMem / 1024 / 1024),
        memoryUsedMb: Math.round(usedMem / 1024 / 1024),
        memoryPercent: Math.round((usedMem / totalMem) * 100),
      },
      checkedAt: now,
    };
  }

  // ─── /logs ──────────────────────────────────────────────────────────────────
  @Get('logs')
  async logs(
    @Query('service') service: string,
    @Query('lines') linesParam?: string,
  ) {
    if (!service) {
      throw new HttpException(
        'Query param "service" is required. Available: ' + [...ALLOWED_SERVICES].join(', '),
        HttpStatus.BAD_REQUEST,
      );
    }

    const normalized = service.toLowerCase().trim();
    if (!ALLOWED_SERVICES.has(normalized)) {
      throw new HttpException(
        `Unknown service "${service}". Available: ${[...ALLOWED_SERVICES].join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const lines = linesParam ? parseInt(linesParam, 10) : 100;
    if (isNaN(lines)) {
      throw new HttpException('Query param "lines" must be a number', HttpStatus.BAD_REQUEST);
    }

    const container = SERVICE_CONTAINERS[normalized];

    try {
      const output = await safeDockerLogs(container, lines);
      return { service: normalized, container, lines, output };
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to fetch logs';
      this.logger.warn(`Logs failed for ${container}: ${msg}`);
      throw new HttpException(
        `Cannot fetch logs for "${service}": ${msg}. Ensure Docker socket is mounted.`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─── /restart ───────────────────────────────────────────────────────────────
  @Post('restart')
  async restart(@Body('service') service: string) {
    if (!service) {
      throw new HttpException('Body field "service" is required', HttpStatus.BAD_REQUEST);
    }

    const normalized = service.toLowerCase().trim();
    if (!ALLOWED_SERVICES.has(normalized)) {
      throw new HttpException(
        `Unknown service "${service}". Available: ${[...ALLOWED_SERVICES].join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const container = SERVICE_CONTAINERS[normalized];

    try {
      const output = await safeDockerRestart(container);
      this.logger.log(`Restarted container: ${container}`);
      return { service: normalized, container, restarted: true, output };
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to restart container';
      this.logger.warn(`Restart failed for ${container}: ${msg}`);
      throw new HttpException(
        `Cannot restart "${service}": ${msg}. Ensure Docker socket is mounted.`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─── /kafka/topics ──────────────────────────────────────────────────────────
  @Get('kafka/topics')
  async kafkaTopics() {
    const kafkaHost = process.env.KAFKA_BROKERS?.split(',')[0]?.split(':')[0] ?? 'kafka';
    const kafkaPort = process.env.KAFKA_BROKERS?.split(',')[0]?.split(':')[1] ?? '9092';

    // Try Kafka admin via docker exec kafka-topics.sh
    try {
      const { stdout } = await execAsync(
        `docker exec unicores-unicore-kafka-1 kafka-topics --bootstrap-server ${kafkaHost}:${kafkaPort} --list 2>/dev/null`,
        { timeout: 10000 },
      );
      const topicNames = stdout.trim().split('\n').filter(Boolean);

      // Try to get message counts via describe
      const topics: Array<{ name: string; partitions?: number; replicas?: number }> = [];
      for (const name of topicNames.slice(0, 50)) {
        topics.push({ name });
      }

      return { brokers: `${kafkaHost}:${kafkaPort}`, topicCount: topics.length, topics };
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to list Kafka topics';
      this.logger.warn(`Kafka topics failed: ${msg}`);
      throw new HttpException(
        `Cannot list Kafka topics: ${msg}. Ensure Docker socket is mounted.`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─── /redis/info ────────────────────────────────────────────────────────────
  @Get('redis/info')
  async redisInfo() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
    let host = 'redis';
    let port = 6379;

    try {
      const parsed = new URL(redisUrl);
      host = parsed.hostname || 'redis';
      port = parseInt(parsed.port || '6379', 10);
    } catch {
      // Use defaults
    }

    try {
      const raw = await fetchRedisInfo(host, port);

      // Parse key sections from INFO output
      const sections: Record<string, Record<string, string>> = {};
      let currentSection = 'default';

      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          if (trimmed.startsWith('# ')) {
            currentSection = trimmed.slice(2).toLowerCase();
            sections[currentSection] = {};
          }
          continue;
        }
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx >= 0) {
          const key = trimmed.slice(0, colonIdx);
          const value = trimmed.slice(colonIdx + 1);
          if (!sections[currentSection]) sections[currentSection] = {};
          sections[currentSection][key] = value;
        }
      }

      const server = sections['server'] ?? {};
      const memory = sections['memory'] ?? {};
      const clients = sections['clients'] ?? {};
      const stats = sections['stats'] ?? {};
      const keyspace = sections['keyspace'] ?? {};

      return {
        host,
        port,
        version: server['redis_version'] ?? 'unknown',
        uptime: server['uptime_in_seconds'] ? parseInt(server['uptime_in_seconds']) : undefined,
        memory: {
          usedHuman: memory['used_memory_human'] ?? '?',
          peakHuman: memory['used_memory_peak_human'] ?? '?',
          maxmemoryHuman: memory['maxmemory_human'] ?? '0B',
          usedBytes: memory['used_memory'] ? parseInt(memory['used_memory']) : undefined,
        },
        clients: {
          connected: clients['connected_clients'] ? parseInt(clients['connected_clients']) : 0,
          blocked: clients['blocked_clients'] ? parseInt(clients['blocked_clients']) : 0,
        },
        stats: {
          totalCommandsProcessed: stats['total_commands_processed']
            ? parseInt(stats['total_commands_processed'])
            : undefined,
          opsPerSec: stats['instantaneous_ops_per_sec']
            ? parseInt(stats['instantaneous_ops_per_sec'])
            : undefined,
          totalKeysExpired: stats['expired_keys']
            ? parseInt(stats['expired_keys'])
            : undefined,
        },
        keyspace,
        raw,
      };
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to connect to Redis';
      this.logger.warn(`Redis info failed (${host}:${port}): ${msg}`);
      throw new HttpException(
        `Cannot connect to Redis at ${host}:${port}: ${msg}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─── /deploy/status ─────────────────────────────────────────────────────────
  @Get('deploy/status')
  async deployStatus() {
    const info: Record<string, string | undefined> = {
      edition: process.env.UNICORE_EDITION,
      version: process.env.npm_package_version ?? process.env.APP_VERSION,
      nodeEnv: process.env.NODE_ENV,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptimeSeconds: String(Math.floor(process.uptime())),
    };

    // Try to get git info from well-known env vars or file
    const gitCommit =
      process.env.GIT_COMMIT ??
      process.env.COMMIT_SHA ??
      process.env.SOURCE_COMMIT;

    const gitBranch =
      process.env.GIT_BRANCH ??
      process.env.BRANCH_NAME;

    const builtAt =
      process.env.BUILD_DATE ??
      process.env.BUILT_AT;

    return {
      ...info,
      git: {
        commit: gitCommit ?? 'N/A',
        branch: gitBranch ?? 'N/A',
        builtAt: builtAt ?? 'N/A',
      },
      features: {
        sso: process.env.ENABLE_SSO === 'true',
        whiteLabel: process.env.ENABLE_WHITE_LABEL === 'true',
        advancedWorkflows: process.env.ENABLE_ADVANCED_WORKFLOWS === 'true',
        allChannels: process.env.ENABLE_ALL_CHANNELS === 'true',
        customDomains: process.env.ENABLE_CUSTOM_DOMAINS === 'true',
        advancedAnalytics: process.env.ENABLE_ADVANCED_ANALYTICS === 'true',
        prioritySupport: process.env.ENABLE_PRIORITY_SUPPORT === 'true',
      },
      checkedAt: new Date().toISOString(),
    };
  }
}
