const kue = require('kue');
const jobs_queue = kue.createQueue();
const exchange = require('open-exchange-rates');
const fx = require('money');
const mongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// array for holding the successful exchange rate
var exchange_array = []; 

/* exchange_job is the job data*/
var exchange_job = {
    from: 'HKD',
    to: 'USD'
};

//mongodb url for connection
var mongo_url = 'mongodb://aftership:test@ds127399.mlab.com:27399/mohit_aftership'; 
// to lookk over the jobs that are stuck
jobs_queue.watchStuckJobs(10000); 

//it sets the appid for open exchange rate
exchange.set({ 
    app_id: 'fd9c6e4e0c3441259e85cc3f47beba71'
});

//function to handle the unexpected error conditions
function catchError() {
    process.exit(0);
}

// function/worker that will be used to process the job
function exchangeWorker(data, done) {
    try {
        exchange.latest(function () { //now we can use exchange.rates, exchange.base
            fx.rates = exchange.rates;
            fx.base = exchange.base;
            var rate = parseFloat(fx(1).from(data.from).to(data.to));
            rate = Math.round(exchange_tmp * 100 + Number.EPSILON) / 100; //rounding off rate to two decimal places
            var tmp = {
                from: data.from,
                to: data.to,
                created_at: new Date(),
                rate: rate
            };
            exchange_array.push(tmp); // push the data into exchange array
            done();
        });
    } catch (error) {
        done(new Error('job error'));
    }
}

//to process the currency_exchange job
jobs_queue.process('currency_exchange', 1, function (job, done) {
    exchangeWorker(job.data, done);
});

//create a currency_exchange job with a delay of 60 seconds and total atempts of 3
jobs_queue.create('currency_exchange', exchange_job).delay(60000).attempts(3).ttl(100000).backoff({
    delay: 3000,
    type: 'fixed'
}).save();

//process to be done once job has completed
jobs_queue.on('job complete', function (id, result) {
    kue.Job.get(id, function (err, job) {
        if (err) {
            catchError();
        } else if (exchange_array.length < 10) { //if echange_array length is less then 10 create another job
            jobs_queue.create('currency_exchange', exchange_job).delay(60000).attempts(3).ttl(100000).backoff({
                delay: 3000,
                type: 'fixed'
            }).save();
        } else { // if exchange_array length is 10 insert data into mongodb
            mongoClient.connect(mongo_url, function (err, db) {
                if (err) {
                    catchError();
                } else {
                    insertDocuments(db, function () {
                        db.close();
                        process.exit(0);
                    });
                }
            });
        }
    });
}).on('job failed', function (id, result) { // if job has failed making all 3 attempts
    kue.Job.get(id, function (err, job) {
        if (err) {
            catchError();
        } else if (exchange_array.length > 0) { // if exchange_array has some data
            mongoClient.connect(mongo_url, function (err, db) {
                if (err) {
                    catchError();
                } else {
                    insertDocuments(db, function () {
                        db.close();
                        process.exit(0);
                    });
                }
            });
        } else {
            console.log('failed');
            process.exit(0);
        }
    });
});

// insertDocuments is the function created to insert the data hold by excange_array into mongodb
var insertDocuments = function (db, callback) {
    // Get the ratePerMinute collection 
    var collection = db.collection('ratePerMinute');
    // Insert some documents 
    collection.insertMany(exchange_array, function (err, result) {
        if (err) {
            catchError();
        } else {
            console.log("Inserted documents into the ratePerMinute collection");
        }
        callback(result);
    });
}