from dotenv import load_dotenv
import os
from influxdb_client import InfluxDBClient

load_dotenv()

client = InfluxDBClient(
    url=os.getenv("INFLUX_URL"),
    token=os.getenv("INFLUX_TOKEN"),
    org=os.getenv("INFLUX_ORG")
)

query = f'''
import "influxdata/influxdb/schema"

schema.measurements(bucket: "{os.getenv("INFLUX_BUCKET")}")
'''

tables = client.query_api().query(query)

for table in tables:
    for record in table.records:
        print(record.get_value())