# data/fetch_data.py

from dotenv import load_dotenv
import os
from influxdb_client import InfluxDBClient
import pandas as pd

load_dotenv()

# Sensors that carry PM2.5/PM10 and can produce an AQI
SENSOR_TOPICS = {
    "lands":    "v3/ardhi-dar-es-salaam@ttn/devices/lands-building/up",
    "planning": "v3/ardhi-dar-es-salaam@ttn/devices/planing-building/up",
}


def _client():
    return InfluxDBClient(
        url=os.getenv("INFLUX_URL"),
        token=os.getenv("INFLUX_TOKEN"),
        org=os.getenv("INFLUX_ORG"),
        timeout=30000,
    )


def fetch_raw_data():
    """Fetch all sensors — used for the legacy combined cache."""
    client = _client()
    bucket = os.getenv("INFLUX_BUCKET")
    query = f'''
    from(bucket: "{bucket}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    df = client.query_api().query_data_frame(query)
    if isinstance(df, list):
        df = pd.concat(df, ignore_index=True)
    client.close()
    return df


def fetch_raw_data_for_sensor(sensor: str) -> pd.DataFrame:
    """Fetch ALL historical data for one sensor (for training)."""
    topic = SENSOR_TOPICS[sensor]
    client = _client()
    bucket = os.getenv("INFLUX_BUCKET")
    query = f'''
    from(bucket: "{bucket}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> filter(fn: (r) => r.topic == "{topic}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    df = client.query_api().query_data_frame(query)
    if isinstance(df, list):
        df = pd.concat(df, ignore_index=True)
    client.close()
    return df


def fetch_recent_data(hours: int = 72):
    """Fetch the last N hours across all sensors (legacy)."""
    client = _client()
    bucket = os.getenv("INFLUX_BUCKET")
    query = f'''
    from(bucket: "{bucket}")
      |> range(start: -{hours}h)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    df = client.query_api().query_data_frame(query)
    if isinstance(df, list):
        df = pd.concat(df, ignore_index=True)
    client.close()
    return df


def fetch_recent_data_for_sensor(sensor: str, hours: int = 72) -> pd.DataFrame:
    """Fetch the last N hours for one sensor (for inference)."""
    topic = SENSOR_TOPICS[sensor]
    client = _client()
    bucket = os.getenv("INFLUX_BUCKET")
    query = f'''
    from(bucket: "{bucket}")
      |> range(start: -{hours}h)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> filter(fn: (r) => r.topic == "{topic}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    df = client.query_api().query_data_frame(query)
    if isinstance(df, list):
        df = pd.concat(df, ignore_index=True)
    client.close()
    return df