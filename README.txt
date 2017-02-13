There are two scripts which are independent of each other but are dependent on schema.js for schema validation of data.

1.currencyconverter_beanstalkd : Converts the HKD to USD and implemented by the use of open-exchange-rate, node and beanstalkd.

2. currencyconverter_kue: Converts the HKD to USD and implemented by the use of open-exchange-rate, node and kue
Kue requires a redis. By default, Kue will connect to Redis using the client default settings (port defaults to 6379, host defaults to 127.0.0.1, prefix defaults to q). In order to run this script please ensure that you have setup a redis over the required machine.

3. schema.js: Checks the schema of the payload and data to be inserted into mongodb, implemented using ajv and bluebird.