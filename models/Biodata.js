const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BiodataSchema = new Schema({
  userid: {
    type: String,
    required: true
  },
  firstname: { type: String, required: true },
  lastname: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    min: 11
  },
  address: {
    type: String
  },
  city: {
    type: String
  },
  state: {
    type: String
  },
  sector: {
    type: String
  },
  description: {
    type: String
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

module.exports = Biodata = mongoose.model("biodata", BiodataSchema);
