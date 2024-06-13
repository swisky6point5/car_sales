# startup:

- run "docker compose up --build" once in main directory!
- import the following volumes:
  - file "car_sales_car-db.tar.gz" -> volume "car-sales-car-db" (otherwise site will not work)
  - file "car_sales_merch-db.tar.gz" -> volume "car-sales-merch-db" (otherwise site will not work)
  - file "car_sales_customer-db.tar.gz" -> volume "car-sales-customer-db" (otherwise login & register will not work)
  - file "car_sales_minio.tar.gz" -> volume "car-sales-minio" (otherwise pictures won't load)

homepage should work now!

optionally import following, for redis-insight to have correct cache linked:
  - file "car_sales_redis-insight.tar.gz" -> volume "car_sales_redis-insight"
