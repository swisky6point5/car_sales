#startup:

- run "docker compose up --build" once in main directory!
- import the following volumes:
  - file "car_sales_car-db.tar.gz" -> volume "car-sales-car-db"
  - file "car_sales_merch-db.tar.gz" -> volume "car-sales-merch-db"
  - file "car_sales_minio.tar.gz" -> volume "car-sales-minio"
homepage should work now!
optionally import following, for redis-insight to have correct cache linked:
  - file "car_sales_redis-insight.tar.gz" -> volume "car_sales_redis-insight"
