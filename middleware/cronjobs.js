const CronJob = require("cron").CronJob;
const helperFunctions = require('./helperFunctions');

module.exports = {
  /* SCHEDULE CRON JOB TO RUN EVERY 7am MON - FRI */
  dailySettlementJob: () => {
    new CronJob("00 10 07 * * 1-5", function() {
      // call function to handle settlement
      helperFunctions.runSettlements()
    }).start();
  }
};
