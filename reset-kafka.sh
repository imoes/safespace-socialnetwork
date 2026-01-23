#!/bin/bash

# Script to reset Kafka and ZooKeeper volumes when cluster ID mismatch occurs

echo "🛑 Stopping Kafka and ZooKeeper containers..."
docker compose stop kafka zookeeper

echo "🗑️  Removing Kafka and ZooKeeper containers..."
docker compose rm -f kafka zookeeper

echo "💾 Removing Kafka and ZooKeeper volumes..."
docker volume rm -f safespace-socialnetwork_kafka_data safespace-socialnetwork_zookeeper_data safespace-socialnetwork_zookeeper_log 2>/dev/null || true

echo "🗑️  Cleaning up old bind mount directories (if they exist)..."
rm -rf ./data/kafka ./data/zookeeper 2>/dev/null || true

echo "✅ Cleanup complete! Starting Kafka and ZooKeeper with fresh state..."
docker compose up -d zookeeper kafka

echo "⏳ Waiting for services to be healthy..."
sleep 5

echo "📊 Checking Kafka status..."
docker compose logs kafka --tail=20

echo ""
echo "✨ Done! Kafka and ZooKeeper have been reset."
echo "   Run 'docker compose up -d' to start all services."
