const exchange = require('open-exchange-rates');
const fx = require('money');
const fivebeans = require('fivebeans');
const client = new fivebeans.client('challenge.aftership.net', 9578);
const currencyWorker = fivebeans.worker;
const mongoClient = require('mongodb').MongoClient;
const assert = require('assert');

/* exchange_job is the job that is seeded into in beanstalkd*/
var exchange_job = {
    type: "exchange",
    payload: {
        from: "HKD",
        to: "USD"
    }
};
var tries = 0; //tries variable to keep the count of the error occured
var exchange_array = []; // array for holding the successful exchange rate
var mongo_url = 'mongodb://aftership:test@ds127399.mlab.com:27399/mohit_aftership'; //mongodb url for connection

function catchError() {
    process.exit(0);
}

//it sets the appid for open exchange rate
exchange.set({
    app_id: 'fd9c6e4e0c3441259e85cc3f47beba71'
});
// insertDocuments is the function created to insert the data hold by excange_array into mongodb
var insertDocuments = function (db, callback) {
    // Get the documents ratePerMinute collection 
    var collection = db.collection('ratePerMinute');
    // Insert some documents 
    collection.insertMany(exchange_array, function (err, result) {
        if (err) {
            catchError();
        } else {
            console.log('inserted documents successfully');
        }
        callback(result);
    });
}

client.on('connect', function () { //client can now be used
    client.use('mohitagarwal124', function (err, tubename) { // use the specified tube mohitagarwal124
        if (err) {
            catchError();
        } else {
            console.log(tubename);
            client.put(0, 60, 30, JSON.stringify(['mohitagarwal124', exchange_job]), function (error, jobid) { //submits the job
                if (error) {
                    catchError();
                } else {
                    console.log(jobid);
                }
            });
        }
    });
}).on('error', function (err) { //connection failure
    catchError();
}).on('close', function () { // underlying connection has closed
    console.log('closed');
    process.exit(0);
});

function indexHandler() {
    this.type = "exchange"; // Specify the type of job for this constructor to work on
}

indexHandler.prototype.work = function (payload, callback) { //Define the work to perform and pass back a success/release/buried
    if (exchange_array.length < 10) { // if exchange array size is less then 10 then reserve the job
        client.reserve(function (err, jobid, pl) { // reserves a job
            if (err) {
                catchError();
            } else {
                console.log('The jobid is ' + jobid + ' and the payload is ' + pl);
            }
        });
    }
    try {
        exchange.latest(function () { // now we can use exchange.rates, exchange.base
            fx.rates = exchange.rates;
            fx.base = exchange.base;
            var rate = parseFloat(fx(1).from(payload.from).to(payload.to));
            rate = Math.round(rate * 100 + Number.EPSILON) / 100; //rounding off rate to two decimal places
            var exchange_data = {
                from: payload.from,
                to: payload.to,
                created_at: new Date(),
                rate: rate
            };
            exchange_array.push(exchange_data);
            if (exchange_array.length < 10) { // if successful attempt is less then 10 then release the job with a delay of 60 seconds
                callback('release', 60);
            } else { // if successful attempt is 10 enter data into mongo db
                mongoClient.connect(mongo_url, function (err, db) {
                    if (err) {
                        catchError();
                    } else {
                        insertDocuments(db, function () {
                            db.close();
                            callback('success');
                            process.exit(0);
                        });
                    }
                });
            }
        });
    } catch (err) {
        tries++;
        if (tries < 3) { // if failure attempt is less then 4 i.e count then release job with delay of 3 seconds
            callback('release', 3);
        } else if (tries >= 3 && exchange_array.length == 0) { // if failure attemp is more then 3 and exchange array length is 0 the exit the process
            callback('bury');
            process.exit(0);
        } else if (tries >= 3 && exchange_array.length > 0) { // if there are more then 3 failure attempt but there are some data in exchange array then feed data into mongodb
            mongoClient.connect(mongo_url, function (err, db) {
                if (err) {
                    catchError();
                } else {
                    insertDocuments(db, function () {
                        callback('bury');
                        db.close();
                        process.exit(0);
                    });
                }
            });
        } else {
            callback('bury');
            process.exit(0);
        }
    }
}

var handler = new indexHandler();
// currencyWorker options
var options = {
    id: 'worker_exchange', // The ID of the worker for debugging and tacking
    host: 'challenge.aftership.net', // The host to listen on
    port: 9578, // the port to listen on
    handlers: {
        'exchange': handler // setting handlers for types
    },
    ignoreDefault: true
};

var worker = new currencyWorker(options); // return the worker object
client.connect(); // to enable connection to the client
worker.start(['mohitagarwal124']); //Connect the currencyWorker to the beanstalkd server & make it watch the specified tube mohitagarwal124