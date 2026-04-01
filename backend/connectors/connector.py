"""
Abstract connector pattern plus concrete implementations for each supported
database type.  All connectors follow the BaseConnector interface so the rest
of the application can treat them uniformly.
"""

import logging
from abc import ABC, abstractmethod
from datetime import date, datetime
from decimal import Decimal

logger = logging.getLogger(__name__)


def _serialize_value(val):
    """Convert non-JSON-serializable DB values to safe Python types."""
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, bytes):
        return val.decode('utf-8', errors='replace')
    return val


def _serialize_row(row):
    return [_serialize_value(v) for v in row]


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class BaseConnector(ABC):
    """Abstract base that every database connector must implement."""

    def __init__(self, connection):
        """
        Parameters
        ----------
        connection : connectors.models.DatabaseConnection
            ORM instance carrying host / port / credentials.
        """
        self.connection = connection
        self._conn = None  # underlying driver connection

    @abstractmethod
    def test_connection(self) -> bool:
        """Return True if a connection can be established successfully."""

    @abstractmethod
    def get_tables(self) -> list:
        """Return a list of table (or collection) names."""

    @abstractmethod
    def fetch_data(self, table: str, batch_size: int = 100, offset: int = 0) -> dict:
        """
        Fetch a slice of rows from *table*.

        Returns
        -------
        dict with keys:
            columns : list[str]
            rows    : list[list]   — each inner list is one row, same order as columns
            total   : int          — total number of rows in the table
        """

    @abstractmethod
    def disconnect(self):
        """Close the underlying connection / cursor."""


# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------

class PostgreSQLConnector(BaseConnector):
    """Connector for PostgreSQL databases using psycopg2."""

    def _get_connection(self):
        import psycopg2
        if self._conn is None or self._conn.closed:
            c = self.connection
            self._conn = psycopg2.connect(
                host=c.host,
                port=c.port,
                dbname=c.database,
                user=c.username,
                password=c.password,
                connect_timeout=10,
            )
        return self._conn

    def test_connection(self) -> bool:
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
            return True
        except Exception as exc:
            logger.warning('PostgreSQL connection test failed: %s', exc)
            return False
        finally:
            self.disconnect()

    def get_tables(self) -> list:
        conn = self._get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            return [row[0] for row in cur.fetchall()]

    def fetch_data(self, table: str, batch_size: int = 100, offset: int = 0) -> dict:
        import psycopg2.extras
        conn = self._get_connection()
        with conn.cursor() as cur:
            # Total row count
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            total = cur.fetchone()[0]

            # Column names
            cur.execute(f'SELECT * FROM "{table}" LIMIT 0')
            columns = [desc[0] for desc in cur.description]

            # Actual data
            cur.execute(f'SELECT * FROM "{table}" LIMIT %s OFFSET %s', (batch_size, offset))
            rows = [_serialize_row(row) for row in cur.fetchall()]

        return {'columns': columns, 'rows': rows, 'total': total}

    def disconnect(self):
        if self._conn and not self._conn.closed:
            self._conn.close()
            self._conn = None


# ---------------------------------------------------------------------------
# MySQL
# ---------------------------------------------------------------------------

class MySQLConnector(BaseConnector):
    """Connector for MySQL databases using mysqlclient (MySQLdb)."""

    def _get_connection(self):
        import MySQLdb
        if self._conn is None:
            c = self.connection
            self._conn = MySQLdb.connect(
                host=c.host,
                port=c.port,
                db=c.database,
                user=c.username,
                passwd=c.password,
                connect_timeout=10,
                charset='utf8mb4',
            )
        return self._conn

    def test_connection(self) -> bool:
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
            cursor.close()
            return True
        except Exception as exc:
            logger.warning('MySQL connection test failed: %s', exc)
            return False
        finally:
            self.disconnect()

    def get_tables(self) -> list:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SHOW TABLES')
        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return tables

    def fetch_data(self, table: str, batch_size: int = 100, offset: int = 0) -> dict:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute(f'SELECT COUNT(*) FROM `{table}`')
        total = cursor.fetchone()[0]

        cursor.execute(f'SELECT * FROM `{table}` LIMIT %s OFFSET %s', (batch_size, offset))
        columns = [desc[0] for desc in cursor.description]
        rows = [_serialize_row(row) for row in cursor.fetchall()]
        cursor.close()

        return {'columns': columns, 'rows': rows, 'total': total}

    def disconnect(self):
        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None


# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------

class MongoDBConnector(BaseConnector):
    """Connector for MongoDB using pymongo."""

    def _get_client(self):
        from pymongo import MongoClient
        if self._conn is None:
            c = self.connection
            uri = (
                f'mongodb://{c.username}:{c.password}@{c.host}:{c.port}'
                f'/{c.database}?authSource=admin'
            )
            self._conn = MongoClient(uri, serverSelectionTimeoutMS=10_000)
        return self._conn

    def _get_db(self):
        return self._get_client()[self.connection.database]

    def test_connection(self) -> bool:
        try:
            client = self._get_client()
            client.server_info()  # raises if no connection
            return True
        except Exception as exc:
            logger.warning('MongoDB connection test failed: %s', exc)
            return False
        finally:
            self.disconnect()

    def get_tables(self) -> list:
        """Return collection names (MongoDB equivalent of tables)."""
        db = self._get_db()
        return db.list_collection_names()

    def fetch_data(self, table: str, batch_size: int = 100, offset: int = 0) -> dict:
        db = self._get_db()
        collection = db[table]

        total = collection.count_documents({})
        cursor = collection.find({}, {'_id': 0}).skip(offset).limit(batch_size)
        documents = list(cursor)

        if not documents:
            return {'columns': [], 'rows': [], 'total': total}

        # Collect superset of all keys to define columns
        all_keys: list = []
        seen: set = set()
        for doc in documents:
            for key in doc.keys():
                if key not in seen:
                    all_keys.append(key)
                    seen.add(key)

        columns = all_keys
        rows = [_serialize_row([doc.get(col) for col in columns]) for doc in documents]

        return {'columns': columns, 'rows': rows, 'total': total}

    def disconnect(self):
        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None


# ---------------------------------------------------------------------------
# ClickHouse
# ---------------------------------------------------------------------------

class ClickHouseConnector(BaseConnector):
    """Connector for ClickHouse using clickhouse-driver."""

    def _get_client(self):
        from clickhouse_driver import Client
        if self._conn is None:
            c = self.connection
            self._conn = Client(
                host=c.host,
                port=c.port,
                database=c.database,
                user=c.username,
                password=c.password,
                connect_timeout=10,
            )
        return self._conn

    def test_connection(self) -> bool:
        try:
            client = self._get_client()
            client.execute('SELECT 1')
            return True
        except Exception as exc:
            logger.warning('ClickHouse connection test failed: %s', exc)
            return False
        finally:
            self.disconnect()

    def get_tables(self) -> list:
        client = self._get_client()
        rows = client.execute(
            'SELECT name FROM system.tables WHERE database = %(db)s ORDER BY name',
            {'db': self.connection.database},
        )
        return [row[0] for row in rows]

    def fetch_data(self, table: str, batch_size: int = 100, offset: int = 0) -> dict:
        client = self._get_client()

        total_rows = client.execute(f'SELECT COUNT(*) FROM "{table}"')
        total = total_rows[0][0]

        # Fetch with column names
        rows, columns_meta = client.execute(
            f'SELECT * FROM "{table}" LIMIT %(limit)s OFFSET %(offset)s',
            {'limit': batch_size, 'offset': offset},
            with_column_types=True,
        )
        columns = [col[0] for col in columns_meta]
        data_rows = [_serialize_row(row) for row in rows]

        return {'columns': columns, 'rows': data_rows, 'total': total}

    def disconnect(self):
        # clickhouse-driver Client has no explicit close, but we reset the ref
        self._conn = None


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

class ConnectorFactory:
    """Return the correct BaseConnector subclass for a given DatabaseConnection."""

    _MAPPING = {
        'postgresql': PostgreSQLConnector,
        'mysql': MySQLConnector,
        'mongodb': MongoDBConnector,
        'clickhouse': ClickHouseConnector,
    }

    @staticmethod
    def get_connector(connection) -> BaseConnector:
        """
        Parameters
        ----------
        connection : connectors.models.DatabaseConnection

        Returns
        -------
        BaseConnector instance

        Raises
        ------
        ValueError if db_type is not supported.
        """
        cls = ConnectorFactory._MAPPING.get(connection.db_type)
        if cls is None:
            raise ValueError(f'Unsupported DB type: {connection.db_type}')
        return cls(connection)
