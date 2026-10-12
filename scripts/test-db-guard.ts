const connection = process.env.CONTEXT_TEST_DATABASE_URL;
if (!connection) throw new Error("Run scripts/test-disposable-db.ps1 to create an isolated test database");
const url = new URL(connection);
if (url.hostname !== "127.0.0.1" || !url.port || url.port === "5432" || url.username !== "context_test"
  || !/^\/context_disposable_[a-f0-9]{32}$/.test(url.pathname)) {
  throw new Error("Integration tests require the generated loopback-only disposable database");
}
process.env.DATABASE_URL = connection;
