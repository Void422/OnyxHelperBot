-- Production received the additive schema before the migration ledger write was
-- retried. The baseline now contains the complete schema for new databases;
-- this no-op lets existing databases record the migration safely.
SELECT 1;
