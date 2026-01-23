#!/bin/bash

echo "🔧 Running database migration for user columns..."
echo ""

# Run the migration script
docker exec -i socialnet-postgres psql -U socialnet -d socialnet < migrate_user_columns.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Now restart the backend container:"
    echo "  docker-compose restart backend"
    echo ""
    echo "Then log out and log back in to see your changes."
else
    echo ""
    echo "❌ Migration failed. Check the error messages above."
    exit 1
fi
