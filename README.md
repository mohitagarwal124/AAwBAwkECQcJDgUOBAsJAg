# Currency-Converter
CurrencyConverter

A simple currency converter from USD to EUR.
Backed by mongo to store data and beanstald as job queue and open exchange rate to find rate.

All configuration level things are in Config.

This application takes in currency and find the rate using open exchange rate and saves the result to mongo. This process continues for 10
successful attempt or 3 failed attempt, this whole process is controlled by beanstalkd job queue.
