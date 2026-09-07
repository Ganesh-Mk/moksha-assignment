-- Runs once, on first initialisation of the Postgres volume.
--
-- The test suite needs a real Postgres because the oversell test exercises
-- SELECT ... FOR UPDATE, which SQLite does not implement. It gets its own database so a test
-- run can never truncate the demo data the reviewer is looking at.
CREATE DATABASE moksha_test OWNER moksha;
