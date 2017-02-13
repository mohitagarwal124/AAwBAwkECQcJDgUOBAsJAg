'use strict';

const Ajv = require('ajv');
const ajv = Ajv({
    allErrors: true
});
const Promise = require('bluebird');

// schema for exchange_data/payload
let exchange_data_schema = {
    'type': 'object',
    'required': ['from', 'to'],
    'minProperties': 2,
    'maxProperties': 2,
    'properties': {
        'from': {
            'type': 'string',
            'pattern': '^HKD$'
        },
        'to': {
            'type': 'string',
            'pattern': '^USD$'
        }
    }
};
// schema for data to be inserted into mongodb
let mongo_data_schema = {
    'type': 'object',
    'required': ['from', 'to', 'created_at', 'rate'],
    'minProperties': 4,
    'maxProperties': 4,
    'properties': {
        'from': {
            'type': 'string',
            'pattern': '^HKD$'
        },
        'to': {
            'type': 'string',
            'pattern': '^USD$'
        },
        'created_at': {
            'format': 'date'
        },
        'rate': {
            'type': 'number'
        }
    }
};
// Generate validating function and cache the compiled schema for future use
let exchange_validate = ajv.compile(exchange_data_schema);
let mongo_validate = ajv.compile(mongo_data_schema);

// function to validate the payload data it receives 
function exchangeTest(data) {
    let valid = exchange_validate(data);
    if (valid) {
        return Promise.resolve(true);
    } else {
        return Promise.reject(false);
    }
}

// function to validate the insertion data it receives
function mongodataTest(data) {
    let valid = mongo_validate(data);
    if (valid) {
        return Promise.resolve(true);
    } else {
        return Promise.reject(false);
    }
}

exports.exchangeTest = exchangeTest;
exports.mongodataTest = mongodataTest;
