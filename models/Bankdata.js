const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BankdataSchema = new Schema({
  userid: {
    type: String,
    required: true
  },
  bankcode: { type: String, required: true },
  accountnumber: {
    type: String,
    required: true,
    min: 10
  },
  accountname: {
    type: String
  },
  identification: {
    type: String
  },
  isprimary : {
    type: Boolean
  },
  created: {
    type: Date,
    default: Date.now
  },
  modified: {
    type: Date,
    default: Date.now
  }
});

module.exports = Bankdata = mongoose.model("bankdata", BankdataSchema);
