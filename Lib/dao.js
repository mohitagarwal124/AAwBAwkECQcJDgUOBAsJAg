const config = require('../Config');
const mongoClient = require('mongodb').MongoClient;

async function dbConnect() {
  try {
    const dbUrl = await mongoClient.connect(config.MONGO.URI);
    const dbName = await dbUrl.db(config.MONGO.DBNAME);
    return dbName;
  } catch (error) {
    throw error;
  }
}

async function insertData(model, data) {
  return model.insert(data);
}

module.exports = {
  dbConnect,
  insertData,
};
