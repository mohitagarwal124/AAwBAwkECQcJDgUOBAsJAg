'use strict';

const exchange = require('open-exchange-rates');
const fx = require('money');
const fivebeans = require('fivebeans');
const client = new fivebeans.client('challenge.aftership.net', 9578);
const currencyWorker = fivebeans.worker;
const mongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const schema = require('./schema.js');

/* exchange_job is the job that is seeded into in beanstalkd*/
let exchange_job = {
    type: 'exchange',
    payload: {
        from: 'HKD',
        to: 'USD'
    }
};

let tries = 0; //  tries variable to keep the count of the error occured
let exchange_array = []; // array for holding the successful exchange rate
let mongo_url = 'mongodb://aftership:test@ds127399.mlab.com:27399/mohit_aftership'; //  mongodb url for connection

// function to handle the unexpected error conditions
function catchError(msg) {
    console.log(msg);
    process.exit(0);
}

//  it sets the appid for open exchange rate
exchange.set({
    app_id: 'fd9c6e4e0c3441259e85cc3f47beba71'
});

/* insertDocuments is the function created to insert the data hold by excange_array into mongodb */
let insertDocuments = function (db, callback) {
    let collection = db.collection('ratePerMinute'); // Get the documents ratePerMinute collection
    collection.insertMany(exchange_array, function (err, result) { // Insert some documents
        try {
            assert.equal(err, null, 'error occured while inserting documents into mongodb'); // unit test for mongodb data insertion
            assert.equal(exchange_array.length, result.result.n, 'count varied from the length of array'); // unit test to validate length
        } catch (e) {
            catchError(e.message);
        }
        callback(result);
    });
};

client.on('connect', function () { // client can now be used
    client.use('mohitagarwal124', function (err, tubename) { // use the specified tube mohitagarwal124
        try {
            assert.equal(tubename, 'mohitagarwal124', 'tube name differ'); // unit test to validate tube name
            // schema validation of exchange job to find whethere payload has correct format or not
            schema.exchangeTest(exchange_job).then(function (res) { // schema check passed
                try {
                    assert.equal(res, true, 'schema validation for payload has failed'); // unit test for schema validation of payload
                    client.put(0, 60, 30, JSON.stringify(['mohitagarwal124', exchange_job]), function (error, jobid) { // submits the job
                        if (error) {
                            catchError('error occured while putting job in tube');
                        } else {
                            console.log(jobid);
                        }
                    });
                } catch (schema_err) {
                    catchError(schema_err.message);
                }
            }, function (rej) { // schema check failed
                catchError('schema validation failed');
            });
        } catch (e) {
            catchError(e.message);
        }
    });
}).on('error', function (err) { // connection failure
    catchError('client connection failed');
}).on('close', function () { // underlying connection has closed
    console.log('client closed');
    process.exit(0);
});

function indexHandler() {
    this.type = 'exchange'; // Specify the type of job for this constructor to work on
}

indexHandler.prototype.work = function (payload, callback) { // Define the work to perform and pass back a success/release/buried
    if (exchange_array.length < 10) { // if exchange array size is less then 10 then reserve the job
        try {
            assert.notEqual(exchange_array, 10, 'trying for attempts more then 10'); // unit test to check aaray length
            client.reserve(function (err, jobid, pl) { // reserves a job
                if (err) {
                    catchError('error occured while reserving job');
                } else {
                    console.log('The jobid is ' + jobid + ' and the payload is ' + pl);
                }
            });
        } catch (e) {
            catchError(e.message);
        }
    }
    try {
        assert.equal(payload.from, 'HKD', 'entered incorrect source in payload'); // unit test for payload source
        assert.equal(payload.to, 'USD', 'entered incorrect target in payload'); // unit test for payload target
        exchange.latest(function () { // now we can use exchange.rates, exchange.base
            try {
                fx.rates = exchange.rates;
                fx.base = exchange.base;
                let rate = parseFloat(fx(1).from(payload.from).to(payload.to));
                rate = Math.round(rate * 100 + Number.EPSILON) / 100; // rounding off rate to two decimal places
                let exchange_data = {
                    from: payload.from,
                    to: payload.to,
                    created_at: new Date(),
                    rate: rate
                };
                assert.equal(Object.keys(exchange_data).length, 4, 'data not as per requirement'); // unit test for data length
                schema.mongodataTest(exchange_data).then(function (res) { // schema check passed
                    exchange_array.push(exchange_data);
                    if (exchange_array.length < 10) { // if successful attempt is less then 10 then release the job with a delay of 60 seconds
                        callback('release', 60);
                    } else { // if successful attempt is 10 enter data into mongo db
                        mongoClient.connect(mongo_url, function (mongo_err, db) {
                            try {
                                assert.equal(mongo_err, null, 'mongodb connection error'); // unit test for mongodb connection
                                insertDocuments(db, function () {
                                    db.close();
                                    callback('success');
                                    process.exit(0);
                                });
                            } catch (err) {
                                catchError(err.message);
                            }
                        });
                    }
                }, function (rej) {
                    if (exchange_array.length > 0) {
                        mongoClient.connect(mongo_url, function (mongo_err, db) {
                            try {
                                assert.equal(mongo_err, null, 'mongodb connection error'); // unit test for mongodb connection
                                insertDocuments(db, function () {
                                    db.close();
                                    callback('success');
                                    process.exit(0);
                                });
                            } catch (err) {
                                catchError(err.message);
                            }
                        });
                    } else {

                        catchError('schema failed');
                    }
                });
            } catch (e) {
                catchError(e.message);
            }
        });
    } catch (err) {
        tries++;
        if (tries < 3) { // if failure attempt is less then 4 i.e count then release job with delay of 3 seconds
            callback('release', 3);
        } else if (tries >= 3 && exchange_array.length === 0) { // if failure attemp is more then 3 and exchange array length is 0 the exit the process
            callback('bury');
            process.exit(0);
        } else if (tries >= 3 && exchange_array.length > 0) { // if there are more then 3 failure attempt but there are some data in exchange array then feed data into mongodb
            mongoClient.connect(mongo_url, function (mongo_err, db) {
                try {
                    assert.equal(mongo_err, null, 'mongodb connection error'); // unit test for mongodb connection
                    insertDocuments(db, function () {
                        callback('bury');
                        db.close();
                        process.exit(0);
                    });
                } catch (e) {
                    catchError(e.message);
                }
            });
        } else {
            callback('bury');
            process.exit(0);
        }
    }
};

let handler = new indexHandler();
// currencyWorker options
let options = {
    id: 'worker_exchange', // The ID of the worker for debugging and tacking
    host: 'challenge.aftership.net', // The host to listen on
    port: 9578, // the port to listen on
    handlers: {
        'exchange': handler // setting handlers for types
    },
    ignoreDefault: true
};

let worker = new currencyWorker(options); // return the worker object
client.connect(); // to enable connection to the client
worker.start(['mohitagarwal124']); //   Connect the currencyWorker to the beanstalkd server & make it watch the specified tube mohitagarwal124
