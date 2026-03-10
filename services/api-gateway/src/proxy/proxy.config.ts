export interface DownstreamService {
  name: string;
  host: string;
  port: number;
  pathPrefix: string;
}

export const DOWNSTREAM_SERVICES: DownstreamService[] = [
  {
    name: 'erp',
    host: process.env.ERP_SERVICE_HOST ?? 'localhost',
    port: parseInt(process.env.ERP_SERVICE_PORT ?? '4100', 10),
    pathPrefix: '/erp',
  },
  {
    name: 'ai-engine',
    host: process.env.AI_ENGINE_SERVICE_HOST ?? 'localhost',
    port: parseInt(process.env.AI_ENGINE_SERVICE_PORT ?? '4200', 10),
    pathPrefix: '/ai',
  },
  {
    name: 'rag',
    host: process.env.RAG_SERVICE_HOST ?? 'localhost',
    port: parseInt(process.env.RAG_SERVICE_PORT ?? '4300', 10),
    pathPrefix: '/rag',
  },
  {
    name: 'bootstrap',
    host: process.env.BOOTSTRAP_SERVICE_HOST ?? 'localhost',
    port: parseInt(process.env.BOOTSTRAP_SERVICE_PORT ?? '4500', 10),
    pathPrefix: '/bootstrap',
  },
] as const;

export function resolveDownstreamService(
  path: string,
): DownstreamService | null {
  return (
    DOWNSTREAM_SERVICES.find(
      (svc) =>
        path === svc.pathPrefix ||
        path.startsWith(svc.pathPrefix + '/'),
    ) ?? null
  );
}
