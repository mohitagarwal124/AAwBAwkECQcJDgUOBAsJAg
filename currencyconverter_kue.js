'use strict';

const kue = require('kue');
const jobs_queue = kue.createQueue();
const exchange = require('open-exchange-rates');
const fx = require('money');
const mongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const schema = require('./schema.js');

// array for holding the successful exchange rate
let exchange_array = [];

/* exchange_job is the job data*/
let exchange_job = {
    from: 'HKD',
    to: 'USD'
};

// mongodb url for connection
let mongo_url = 'mongodb://aftership:test@ds127399.mlab.com:27399/mohit_aftership';

// to look over the jobs that are stuck
jobs_queue.watchStuckJobs(10000);

// it sets the appid for open exchange rate
exchange.set({
    app_id: 'fd9c6e4e0c3441259e85cc3f47beba71'
});

// function to handle the unexpected error conditions
function catchError(msg) {
    console.log(msg);
    process.exit(0);
}

// function/worker that will be used to process the job
function exchangeWorker(data, done) {
    try {
        assert.equal(data.from, 'HKD', 'entered incorrect source in payload'); // unit test for payload source
        assert.equal(data.to, 'USD', 'entered incorrect target in payload'); // unit test for payload target
        exchange.latest(function () { // now we can use exchange.rates, exchange.base
            try {
                fx.rates = exchange.rates;
                fx.base = exchange.base;
                let rate = parseFloat(fx(1).from(data.from).to(data.to));
                rate = Math.round(rate * 100 + Number.EPSILON) / 100; // rounding off rate to two decimal places
                let tmp = {
                    from: data.from,
                    to: data.to,
                    created_at: new Date(),
                    rate: rate
                };
                assert.equal(Object.keys(tmp).length, 4, 'data not as per requirement'); // unit test for data length
                // schema validation of data to be entered into mongodb
                schema.mongodataTest(tmp).then(function (res) { // schema check passed
                    exchange_array.push(tmp); // push the data into exchange array
                    done();
                }, function (rej) { // schema check failed
                    done(new Error('schema failed'));
                });
            } catch (e) {
                done(new Error('job error'));
            }
        });
    } catch (error) {
        done(new Error('job error'));
    }
}

// to process the currency_exchange job
jobs_queue.process('currency_exchange', 1, function (job, done) {
    exchangeWorker(job.data, done);
});

// schema validation of exchange job to find whethere payload has correct format or not
schema.exchangeTest(exchange_job).then(function (res) { // schema check passed
    try {
        assert.equal(res, true, 'schema validation for payload has failed'); // unit test for schema validation of payload
        //     create a currency_exchange job with a delay of 60 seconds and total atempts of 3
        jobs_queue.create('currency_exchange', exchange_job).delay(60000).attempts(3).ttl(100000)
            .backoff({
                delay: 3000,
                type: 'fixed'
            })
            .save();
    } catch (e) {
        catchError(e.message);
    }
}, function (rej) { // schema check failed
    catchError('schema validation failed');
});


// process to be done once job has completed
jobs_queue.on('job complete', function (id, result) {
    kue.Job.get(id, function (err, job) {
        if (err) {
            catchError('error on job complete');
        } else {
            if (exchange_array.length < 10) { // if echange_array length is less then 10 create another job
                try {
                    assert.notEqual(exchange_array.length, 10, 'trying for attempts more then 10'); // unit test to check aaray length
                    schema.exchangeTest(exchange_job).then(function (res) { // schema validation of exchange job to find whethere payload has correct format or not
                        jobs_queue.create('currency_exchange', exchange_job).delay(60000).attempts(3).ttl(100000)
                            .backoff({
                                delay: 3000,
                                type: 'fixed'
                            })
                            .save();
                    }, function (rej) { // schema validation failed
                        catchError('schema validation failed');
                    });
                } catch (e) {
                    catchError(e.message);
                }
            } else { // if exchange_array length is 10 insert data into mongodb
                try {
                    assert.equal(exchange_array.length, 10, 'trying for attempts more then 10'); // unit test to check array length
                    mongoClient.connect(mongo_url, function (mongo_err, db) {
                        try {
                            assert.equal(mongo_err, null, 'mongodb connection error'); // unit test for mongodb connection
                            insertDocuments(db, function () {
                                db.close();
                                process.exit(0);
                            });
                        } catch (error) {
                            catchError(error.message);
                        }
                    });
                } catch (e) {
                    catchError(e.message);
                }
            }
            job.remove(function (job_err) {});
        }
    });
}).on('job failed', function (id, result) { // if job has failed making all 3 attempts
    kue.Job.get(id, function (err, job) {
        if (err) {
            catchError('job has failed after 3 attempts');
        } else if (exchange_array.length > 0) { // if exchange_array has some data
            mongoClient.connect(mongo_url, function (mongo_err, db) {
                try {
                    assert.equal(mongo_err, null, 'mongodb connection error'); // unit test for mongodb connection
                    insertDocuments(db, function () {
                        db.close();
                        process.exit(0);
                    });
                } catch (e) {
                    catchError(e.message);
                }
            });
        } else {
            catchError('job failed, please try again');
        }
    });
});

// insertDocuments is the function created to insert the data hold by excange_array into mongodb
let insertDocuments = function (db, callback) {
    // Get the ratePerMinute collection
    let collection = db.collection('ratePerMinute');
    // Insert some documents
    collection.insertMany(exchange_array, function (err, result) {
        try {
            assert.equal(err, null, 'error occured while inserting documents into mongodb'); // unit test for mongodb data insertion
            assert.equal(exchange_array.length, result.result.n, 'count varied from the length of array'); // unit test to validate length
        } catch (e) {
            catchError(e.message);
        }
        callback(result);
    });
};
