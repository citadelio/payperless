const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BanksSchema = new Schema({
  status: {
    type: Number,
    default: 0
  },
  banks: Array,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = Banks = mongoose.model("bank", BanksSchema);
