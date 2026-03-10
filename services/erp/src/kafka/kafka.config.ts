export function getKafkaBrokers(): string[] {
  const brokers = process.env.KAFKA_BROKERS ?? 'localhost:9092';
  return brokers.split(',').map((b) => b.trim());
}
