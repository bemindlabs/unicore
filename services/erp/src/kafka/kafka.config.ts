export function getKafkaBrokers(): string[] {
  return (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',').map((b) => b.trim());
}
