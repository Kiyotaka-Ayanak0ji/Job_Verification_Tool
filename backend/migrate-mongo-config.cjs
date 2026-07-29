const {env} = require("./src/config/env");

module.exports = {
  mongodb: {
    url: env.MONGO_URI || "mongodb://localhost:27017",
    databaseName: "trusthire",
    options: {},
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".cjs",
};
